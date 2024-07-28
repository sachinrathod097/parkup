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
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import { AlertController, IonModal, Platform } from '@ionic/angular';
import firebase from 'firebase/compat/app';
import 'firebase/firestore';
import { HttpClient } from '@angular/common/http';
import { LaunchNavigator } from '@awesome-cordova-plugins/launch-navigator/ngx';

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
  selected: boolean = false;
  constructor(public dbService: DatabaseService, public http: HttpClient, public launchNav: LaunchNavigator, public plt: Platform,   private alertCtrl: AlertController) { }
  public parkinglot: db_parkinglot = {
    availability: "N/A",
    coordinates: new firebase.firestore.GeoPoint(0, 0),
    name: 'Searching',
    pid: '',
    price: 'N/A',
    street: false,
    crimerate: 5,
    rating: "3.5",
  };
  public oldExtent: any;
  public image = "";
  // @ts-ignore
  public nearByParkinglots: Observable<db_parkinglot[]>;
  async ngOnInit() {
    const position = await Geolocation.getCurrentPosition();
    this.currentLocation = new Point({
      longitude: -118.289329,
      latitude: 34.025599
    })
    this.nearByParkinglots = this.dbService.watchParkinglots();

    esriConfig.apiKey = "AAPTxy8BH1VEsoebNVZXo8HurJPd1YxuAvtilR4Oj-eMC3J8CTubEtg7vHQVygz7hKrVJOXVQ8sTkm5QkfzWuVcHjcXTjbG4h76o4tpSwCuvMU20ehecGgFMBZoWIYp1qxE44TN4SHc-LTyrxfmoWpq61fin8vR94MZzw7aRm8BDL7ZLFyg5jC9FrSdDljzuKkQupWdyv3bAuRt7a8x4OQ9d9StYSpCHvuxS4zddaIc0o5ZPMz42gu8w9oCUQ7XIll7qa-lym124KXw2BumekZAfXQ..AT1_leICqsXp";
    const webmap = new WebMap({
      portalItem: {
        id: "a1ebd050b5c44f7e9443ff8b157d780f",
      }
    });

    this.view = new MapView({
      container: "map_canvas",
      map: webmap,
      zoom: 18,
      center: this.currentLocation
    });

    reactiveUtils.watch(
      () => [this.view.stationary, this.view.extent],
      ([stationary, extent], [wasStationary]) => {
        if (stationary) {
          try {
            // @ts-ignore
            this.dbService.getNearByStreetParkinglots(extent.center);
            // @ts-ignore
            this.findNearByParkinlotsService(extent.center, 3000);
          }
          catch { }

        }
      }
    );

    this.view.on('click', (event) => {
      const opts = {
        include: this.view.graphics.toArray()
      }
      this.view.hitTest(event, opts).then(async (response) => {
        if (response.results.length) {
          // @ts-ignore
          this.parkinglot = response.results[0].graphic.attributes;
          const index = Math.floor(Math.random() * 4) + 1;
          this.image = "../../assets/";
          if(this.parkinglot.street){
            this.image += "street_" + index.toString() + ".png";
          }
          else{
            if(Math.floor(Math.random() * 2)){
              this.image += "lot_" + index.toString() + ".png";
            }
            else{
              this.image += "garage_" + index.toString() + ".png";
            }
          }
          this.selected = true;
          await this.parkinglotModal.dismiss();
          this.parkinglotModal.initialBreakpoint = 0.65;
          this.parkinglotModal.setCurrentBreakpoint(0.65);
          await this.parkinglotModal.present();
        }
      });
    });
    // var parkings: any = await this.dbService.pullData();
    // console.log(parkings.length)
    // await this.dbService.pushData(parkings);
  }

  addCurrentAddressInfo() {
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
      if (parkinglots) {
        this.parkinglot = parkinglots[0];
        for (var i = 0; i < parkinglots.length; i++) {
          this.addParkingLotGraphic(parkinglots[i]);
          if ((i + 1) % 100 == 0) {
            await this.sleep(3000);
          }
        }
      }

    });
    this.dbService.getNearByStreetParkinglots(this.view.center);
    this.findNearByParkinlotsService(this.view.center, 3000);
    this.allSubscription.push(streetParkinglotSub);
  }

  async findNearByParkinlotsService(point: Point, radius: number) {
    var parkingID = "19020";
    var searchCount = 20;
    var token = "AAPTxy8BH1VEsoebNVZXo8HurOvDojB09Xw7ZKgOZin7PquaH18eTQ-TQSqSDDNG73OJDJHjCRgLUvxKB3LOA6jZkcjALEZ7a7OMX1L15vhxTjA5fxufOpGu30RIkEeOrAGik-shuIBVx2-EeRVkswUaDtkWZQ7kaMyF8UWnPeojH9R4IX3oX28U310k-at-EDGzEQZvrJ0hyhWDYlBrF1AiCDwacVMC3Qv1VwJr-x5QrqY.AT1_Tk6GGjYD";
    var url = " https://places-api.arcgis.com/arcgis/rest/services/places-service/v1/places/near-point?f=json&x=" + point.longitude + "&y=" + point.latitude + "&radius=" + radius + "&categoryIds=" + parkingID + "&pageSize=" + searchCount + "&token=" + token;
    const headers = {
      'Accept': 'application/json'
    };

    fetch(url,
      {
        method: 'GET',
        headers: headers
      })
      .then(async (res) => {
        return res.json();
      }).then((body) => {
        var parkingLots = body.results;

        for (var i = 0; i < parkingLots.length; i++) {
          console.log(parkingLots[i].placeId);
          var parkingLot: db_parkinglot = {
            availability: "N/A",
            coordinates: new firebase.firestore.GeoPoint(parkingLots[i].location.y, parkingLots[i].location.x),
            name: parkingLots[i].name,
            pid: parkingLots[i].placeId,
            price: "N/A",
            street: false,
            crimerate: 5,
            rating: "3.5",
          }
          this.dbService.insertParkingLot(parkingLot);
        }
      });
  }

  ionViewWillLeave() {
    for (var i = 0; i < this.allSubscription.length; i++) {
      this.allSubscription[i].unsubscribe();
    }
  }

  addParkingLotGraphic(parkinglot: db_parkinglot) {
    const allPids = [];
    const allGrpahic = this.view.graphics.toArray();
    for (var i = 0; i < allGrpahic.length; i++) {
      allPids.push(allGrpahic[i].attributes.pid);
    }
    var popupTemplate;
      var icon = "";
      var width = 0;
      var height = 0;
      if (parkinglot.street) {
        if(parkinglot.availability == 'VACANT'){
          icon = "../../assets/street_empty.png";
        }
        else{
          icon = "../../assets/street_busy.png"
        }
        popupTemplate = {
          // autocasts as new PopupTemplate()
          title: parkinglot.name + " - " + parkinglot.pid,
          content: "Availability: " + parkinglot.availability + "<br>" + "Price: " + parkinglot.price,
        }
        width = 30;
        height = 30;
      }
      else {
        width = 50;
        height = 50;
        console.log(parkinglot.availability);
        switch(parkinglot.availability){
          case "VACANT":
            icon = "../../assets/empty.png";
            break;
          case "MEDIUM":
            icon = "../../assets/middle.png";
            break;
          case "OCCUPIED":
            icon = "../../assets/busy.png";
            break;
          case "N/A":
            icon = "../../assets/na.png";
            break;
        }
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

      var symbol = new PictureMarkerSymbol({
        "angle": 0, "xoffset": 0, "yoffset": 10, "url": icon, "width": width, "height": height, color: "black"
      });
      const iconGraphic = new Graphic({
        attributes: parkinglot,
        geometry: parkinglotPoint,
        symbol: symbol
      });
    if (!allPids.includes(parkinglot.pid)) {
      this.view.graphics.add(iconGraphic);
    }
    else{
      var currentParkinglotIndex = this.view.graphics.toArray().findIndex(graphic => graphic.attributes.pid == parkinglot.pid);
      // //@ts-ignore
      if(this.view.graphics.at(currentParkinglotIndex).symbol != symbol){
        console.log("removing")
        this.view.graphics.at(currentParkinglotIndex).symbol = symbol;
      }
    }
  }

  async navigator(){
    const alert = await this.alertCtrl.create({
      header: 'Please take our survey after you arrive to help other people ParkSmart!',
      message: 'Open Google Map?',
      cssClass: 'logout',
      mode: 'ios',
      buttons: [
        {
          text: 'NO',
          role: 'cancel',
          cssClass: 'no',
        },
        {
          text: 'YES',
          cssClass: 'yes',
          handler: () => {
            this.launchNavigator();
          }
        }
      ],
    });
    await alert.present();
  }

  launchNavigator(){
    const destination = [this.parkinglot.coordinates.latitude, this.parkinglot.coordinates.longitude];
    this.launchNav.navigate(destination, {app: this.plt.is('ios') ? this.launchNav.APP.APPLE_MAP : this.launchNav.APP.GOOGLE_MAPS}).then(() => {}).catch(err => {
    });
  }

}
