/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from 'node-fetch';

admin.initializeApp(functions.config().firebase);

export interface parking_occupancy {
    "spaceid": string,
    "occupancystate": string
}

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

const runtimeOpts: functions.RuntimeOptions = {
    timeoutSeconds: 540,
    memory: '256MB'
};


// live street parking occupancy fetcher

export const fetchOccupancy = async (): Promise<{ liveOccupancy: parking_occupancy[] }> => {
    const response = await fetch('https://data.lacity.org/resource/e7h6-4a3e.json?$limit=40000');
    // @ts-ignore
    const liveOccupancy: parking_occupancy[] = await response.json()
    return { liveOccupancy };
}

export const liveOccupancyScheduler = functions.region('us-west2').runWith(runtimeOpts).pubsub.schedule("* * * * *").timeZone("US/Pacific").onRun(async () => {
    const db = admin.firestore();
    const collection = db.collection("parkinglots");
    const { liveOccupancy } = await fetchOccupancy();
    var batch = db.batch();
    const index = liveOccupancy.length;
    logger.info(index);
    logger.info(liveOccupancy);
    for (let i = 0; i < index; i++) {
        var parkinglot = liveOccupancy[i];
        var db_parking = {
            availability: parkinglot.occupancystate,
        }
        const docRef = collection.doc(parkinglot.spaceid);
        if ((await docRef.get()).exists) {
            batch.update(docRef, db_parking);
            if ((i + 1) % 499 === 0) {
                await batch.commit();
                batch = db.batch();
            }
        }
    }
    // For committing final batch
    if (!(index % 499 == 0)) {
        logger.info("final commit");
        await batch.commit();
    }
    logger.info("Live updated the street parking lots!");
    return;
});

// live parking garage / lots occupancy fetcher from Survey123

async function get_survey_token() {
    const url = "https://www.arcgis.com/sharing/generateToken?f=json&referer=https://www.arcgis.com";
    const body = new URLSearchParams({
        username: "ajohnson_intern_hackathon",
        password: "HackathonNo.1"
    });

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString()
        });
        const data = await response.json();
        // @ts-ignore
        return data.token;
    } catch (error) {
        console.error("Error:", error);
        return null;
    }
}

async function get_survery_data() {
    try {
        const token = await get_survey_token();
        if (!token) {
            throw new Error("Failed to retrieve token");
        }

        const url = `https://services8.arcgis.com/LLNIdHmmdjO2qQ5q/ArcGIS/rest/services/survey123_f6e0d0f944d44d70bd1bed0b120d1de5_results/FeatureServer/0/query?where=1%3D1&outFields=*&f=pjson&token=${token}`;

        const response = await fetch(url);
        const data = await response.json();
        // @ts-ignore
        const extractedData = data.features.map((feature: any) => {
            return {
                pid: feature.attributes.pid,
                untitled_question_1: feature.attributes.untitled_question_1
            };
        });

        return extractedData;
    } catch (error) {
        console.error("Error:", error);
        return null;
    }
}

export const surveryOccupancyScheduler = functions.region('us-west2').runWith(runtimeOpts).pubsub.schedule("* * * * *").timeZone("US/Pacific").onRun(async () => {
    const db = admin.firestore();
    const collection = db.collection("parkinglots");
    var batch = db.batch();
    get_survery_data().then((async (survery_data) => {
        logger.info(survery_data.length);
        logger.info(survery_data);
        const index = survery_data.length;
        for (let i = 0; i < index; i++) {
            var parkinglot = survery_data[i];
            var parking_status = parkinglot.untitled_question_1
            var db_parking = {
                availability: parking_status,
            }
            
            var pid = parkinglot.pid.toString()
            const docRef = collection.doc(pid);
            if ((await docRef.get()).exists) {
                batch.update(docRef, db_parking);
                if ((i + 1) % 499 === 0) {
                    await batch.commit();
                    batch = db.batch();
                }
            }
        }
        if (!(index % 499 == 0)) {
            logger.info("final commit");
            batch.commit();
        }
    }));
    logger.info("Live updated the parking lots/garages!");
    return;
});
