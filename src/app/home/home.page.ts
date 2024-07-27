import { Component, ViewChild } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import Point from '@arcgis/core/geometry/Point';
import esriConfig from '@arcgis/core/config';
import MapView from '@arcgis/core/views/MapView';
import WebMap from '@arcgis/core/WebMap';
import Graphic from '@arcgis/core/Graphic';
import OffsetParameters from "@arcgis/core/rest/support/OffsetParameters";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import { DatabaseService, db_parkinglot } from '../services/database.service';
import { Observable, Subscription, take } from 'rxjs';
import PictureMarkerSymbol from '@arcgis/core/symbols/PictureMarkerSymbol';
import { IonModal } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  @ViewChild('parkinglotModal')
  parkinglotModal!: IonModal

  private currentLocation: Point = new Point;
  private view: MapView = new MapView;
  streetParkingLots: db_parkinglot[] = [];
  private allSubscription: Subscription[] = [];
  constructor(public dbService: DatabaseService) {}
  public attributes: any;
  public oldExtent: any;
  // @ts-ignore
  public nearByParkinglots: Observable<db_parkinglot[]>;
  async ngOnInit(){
    const position = await Geolocation.getCurrentPosition();
    this.currentLocation = new Point({
      longitude: -118.289329,
      latitude: 34.025599
    })
    this.nearByParkinglots = this.dbService.watchParkinglots();

    esriConfig.apiKey = "AAPTxy8BH1VEsoebNVZXo8HurGVM5WhO0kgNBvtPp3_A3qg2UCHT8zzIoYWmVeGkLgoQhDzY6rQGZEnGhOgL7bz_vnU4V3A5Jd-3KOYeQW2pWRY8tD3NRcZnYMiMy33GLteXoxH5DjTwfkL4lOMrazWJONKoMLtJhVWjwMuwq10rWDK3eMK3ekkI4ObOrp0Gtxpkcq_aLW9Q9oBOg8lJKFDIe5rBlSJEaNhnMiiYOpNxZQUkEAKeOLrryDagRhkCbplbAT1_FD6f29Ym";
    const webmap = new WebMap({
      portalItem:{
        id: "26f330701a8f4a9192cacc3339b0ccb7",
      }
    });

    this.view = new MapView({
      container: "map_canvas",
      map: webmap,
      zoom: 18,
      center: this.currentLocation
    });

    // this.view.map.on("drag", (event) => {
    //   console.log(event)
    //   var point = this.getCenterPoint();
    //   console.log(this.view.center.longitude);
    //   console.log(this.view.center.latitude);
    // });

    reactiveUtils.watch(
        () => [this.view.stationary, this.view.extent],
        ([stationary, extent], [wasStationary]) => {
            if (stationary) {
                try{
                  // @ts-ignore
                  this.dbService.getNearByStreetParkinglots(extent.center);
                }
                catch{}

            }
        }
    );

    this.view.on('click', (event) => {
      const opts = {
        include: this.view.graphics.toArray()
      }
      console.log("IIIIIIIINNNNNNNNNN")
      this.view.hitTest(event, opts).then(async (response) => {
        console.log(response.results)
        // check if a feature is returned from the hurricanesLayer
        if (response.results.length) {
          console.log("IIIIIIIINNNNNNNNNN")
          // do something with the graphic
          // @ts-ignore
          this.attributes = response.results[0].graphic.attributes;
          // this.parkinglotModal.overlayIndex = 5;
          // this.parkinglotModal.showBackdrop = false;
          //await this.parkinglotModal.present();
        }
      });
    });
    // var parkings: any = await this.dbService.pullData();
    // console.log(parkings.length)
    // await this.dbService.pushData(parkings);
  }

  addCurrentAddressInfo(){
    var symbol = new PictureMarkerSymbol({ "angle": 0, "xoffset": 0, "yoffset": 10, "url": "http://static.arcgis.com/images/Symbols/Shapes/RedPin1LargeB.png", "width": 30, "height": 40 });
    const currentPositionGraphic = new Graphic({
      geometry: this.currentLocation,
      symbol: symbol,
      popupTemplate: {
        title: "Your Location",
        content: "Here"
      }
    });
    this.view.graphics.add(currentPositionGraphic);
  }

  sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async ionViewDidEnter() {
      // start ploting street parking lots
      const streetParkinglotSub = this.nearByParkinglots.subscribe(async parkinglots => {
        
        if(parkinglots){
          console.log("in")
          for(var i=0; i<parkinglots.length; i++){
            if(i == 0){
              this.view.center = new Point({
                longitude: parkinglots[i].coordinates.longitude,
                latitude: parkinglots[i].coordinates.latitude
              });
            }
            this.addParkingLotGraphic(parkinglots[i]);
            if((i+1) % 100 == 0){
              await this.sleep(3000);
            }
          }
        }
        
      });
      this.dbService.getNearByStreetParkinglots(this.view.center);
      this.allSubscription.push(streetParkinglotSub);
      
  }

  ionViewWillLeave() {
    for (var i = 0; i < this.allSubscription.length; i++) {
      this.allSubscription[i].unsubscribe();
    }
  }

  addParkingLotGraphic(parkinglot: db_parkinglot) {
    var popupTemplate;
    if(parkinglot.street){
      popupTemplate = {
        // autocasts as new PopupTemplate()
        title: parkinglot.name + " - " + parkinglot.pid,
        content: "Availability: " + parkinglot.availability + "<br>" + "Price: " + parkinglot.price,
      }
    }
    else{
      popupTemplate = {
        // autocasts as new PopupTemplate()
        title: parkinglot.name,
        content: "Availability: " + parkinglot.availability + "<br>" + "Price: " + parkinglot.price,
      }
    }
    const parkinglotPoint = new Point({
      longitude: parkinglot.coordinates.longitude,
      latitude: parkinglot.coordinates.latitude
    });
    const attributes = {
      "pid": parkinglot.pid,
      "name": parkinglot.name,
      "lat": parkinglot.coordinates.latitude,
      "lan": parkinglot.coordinates.latitude,
      "availability": parkinglot.availability,
      "price": parkinglot.price
    }
    const graphic = new Graphic({
      attributes: attributes,
      geometry: parkinglotPoint,
      symbol: {
        // @ts-ignore
        type: "simple-marker",
        color: "skyblue",
        size: "17px",
      },
      //popupTemplate: popupTemplate
    });
    this.view.graphics.add(graphic);
  }

}
