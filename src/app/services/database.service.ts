import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import Point from '@arcgis/core/geometry/Point';
import firebase from 'firebase/compat/app';
import 'firebase/firestore';
import * as geofirestore from 'geofirestore';
import { BehaviorSubject, debounceTime, lastValueFrom, map, Observable, take, takeLast } from 'rxjs';

export interface latlng{
  "latitude": string,
  "longitude": string
}

export interface parkinglot{
  "spaceid": string,
  "blockface": string,
  "raterange": string,
  "latlng": latlng,
}

export interface db_parkinglot{
  "pid": string,
  "name": string,
  "street": boolean,
  "price": string,
  "availability": string,
  "coordinates": firebase.firestore.GeoPoint,
  "rating": string,
  "crimerate": number
}

@Injectable({
  providedIn: 'root'
})

export class DatabaseService {
  gfs: geofirestore.GeoFirestore;
  parkinglots: parkinglot[] = [];
  parkinglotSub: any;
  // @ts-ignore
  private parkinglotsSubject: BehaviorSubject<db_parkinglot[]> = new BehaviorSubject(undefined);
  private geoParkinglotCollection: geofirestore.GeoCollectionReference;
  constructor(public http: HttpClient, public afs: AngularFirestore) { 
    //@ts-ignore
    this.gfs = geofirestore.initializeApp(this.afs.firestore);
    this.geoParkinglotCollection = this.gfs.collection("parkinglots");
  }

  // do not call this function
  async pullData(): Promise<parkinglot> {
    return await lastValueFrom<parkinglot>(this.http.get<parkinglot>("https://data.lacity.org/resource/s49e-q6j2.json?$limit=40000").pipe(
      take(1)
    ));
  }

  //do not call this function
  async pushData(parkinglots: any): Promise<void>{
    this.parkinglots = parkinglots;
    var batch = this.gfs.batch();
    const index = this.parkinglots.length;
    for (let i=0; i < index; i++) {
      var parkinglot = this.parkinglots[i];
          var db_parking: db_parkinglot = {
            availability: "VACANT",
            coordinates: new firebase.firestore.GeoPoint(Number(parkinglot.latlng.latitude), Number(parkinglot.latlng.longitude)),
            name: parkinglot.blockface,
            pid: parkinglot.spaceid,
            price: parkinglot.raterange,
            street: true,
            crimerate: 5,
            rating: "3.5",
          }
      const docRef = this.geoParkinglotCollection.doc(parkinglot.spaceid);
      batch.set(docRef, db_parking);
      if ((i + 1) % 499 === 0) {
        await batch.commit();
        batch = this.gfs.batch();
      }
    }
    // For committing final batch
    if (!(index % 499 == 0)) {
      console.log("final commit");
      await batch.commit();
    }
  }

  destroyParkinglotSub(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        if (this.parkinglotSub) {
          this.parkinglotSub();
        }
        resolve();
      }
      catch (e) {
        reject(e)
      }
    })
  }

  watchParkinglots(): Observable<db_parkinglot[]> {
    return this.parkinglotsSubject.asObservable();
  }

  getStretParkingLots(): Observable<db_parkinglot[]> {
    return this.afs.collection<db_parkinglot>("parkinglots").snapshotChanges().pipe(
      debounceTime(500),
      map(actions => {
        return actions.map(a => {
          const data = a.payload.doc.data();
          const id = a.payload.doc.id;
          return { id, ...data }
        });
      })
    )
  }

  async getNearByStreetParkinglots(position: Point){
    //await this.destroyParkinglotSub();
    this.parkinglotSub = this.gfs.collection('parkinglots').near({ center: new firebase.firestore.GeoPoint(position.latitude, position.longitude), radius: 2 }).onSnapshot(
      async res => {
        console.log(res.docs.length);
        var nearByParkinglots: db_parkinglot[] = [];
        for(var i=0; i<res.docs.length; i++){
          // @ts-ignore
          nearByParkinglots.push(res.docs[i].data())
        }
        this.parkinglotsSubject.next([...nearByParkinglots]);
      }
    );
  }

  async insertParkingLot(parkingLot:db_parkinglot){
    var docRef = await this.afs.collection("parkinglots").doc(parkingLot.pid).ref.get();
    if(!docRef.exists){
      this.geoParkinglotCollection.doc(parkingLot.pid).set(parkingLot); 
    }
  }

}
