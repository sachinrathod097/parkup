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

export interface parking_occupancy{
    "spaceid": string,
    "occupancystate": string
}

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

const runtimeOpts : functions.RuntimeOptions = { 
    timeoutSeconds: 540,
    memory: '256MB'
};

export const fetchOccupancy = async () : Promise<{ liveOccupancy : parking_occupancy[] }>  => {
    const response = await fetch('https://data.lacity.org/resource/e7h6-4a3e.json?$limit=40000');
    // @ts-ignore
    const liveOccupancy : parking_occupancy[]= await response.json() 
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
    for (let i=0; i < index; i++) {
        var parkinglot = liveOccupancy[i];
        var db_parking = {
            availability: parkinglot.occupancystate,
        }
        const docRef = collection.doc(parkinglot.spaceid);
        if((await docRef.get()).exists){
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
