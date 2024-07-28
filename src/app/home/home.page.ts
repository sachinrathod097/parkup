import { Component, ViewChild } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import Point from '@arcgis/core/geometry/Point';
import esriConfig from '@arcgis/core/config';
import MapView from '@arcgis/core/views/MapView';
import WebMap from '@arcgis/core/WebMap';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import { DatabaseService, db_parkinglot } from '../services/database.service';
import { debounceTime, Observable, Subscription, take } from 'rxjs';
import Zoom from '@arcgis/core/widgets/Zoom';
import PictureMarkerSymbol from '@arcgis/core/symbols/PictureMarkerSymbol';
import { ActionSheetController, AlertController, IonModal, Platform } from '@ionic/angular';
import firebase from 'firebase/compat/app';
import 'firebase/firestore';
import { HttpClient } from '@angular/common/http';
import { LaunchNavigator } from '@awesome-cordova-plugins/launch-navigator/ngx';
import Search from '@arcgis/core/widgets/Search';

export interface SurveyData {
  "pid": string,
  "availability": string
}

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
  private zoomWidget: Zoom = new Zoom;
  private allSubscription: Subscription[] = [];
  public recommend = false;
  selected: boolean = false;
  surveyData: SurveyData = {
    "pid": "",
    "availability": ""
  };
  public selectedParkinglots: db_parkinglot[] = [];
  public garage_recommend = false;
  public garage_recommend_prev_value = false;
  public parking_lot = false;
  private searchWidget: Search = new Search;
  private locatorWidget: HTMLElement | null = null;
  constructor(public dbService: DatabaseService, public http: HttpClient, public launchNav: LaunchNavigator, public plt: Platform, private alertCtrl: AlertController, private actionSheetCtrl: ActionSheetController) { }
  public parkinglot: db_parkinglot = {
    availability: "N/A",
    coordinates: new firebase.firestore.GeoPoint(0, 0),
    name: 'Searching',
    pid: '',
    price: 'N/A',
    street: false,
    crimerate: 5,
    rating: 3.5,
  };
  public oldExtent: any;
  public image = "";
  public recommendedStreetParking: db_parkinglot = {
    availability: "N/A",
    coordinates: new firebase.firestore.GeoPoint(0, 0),
    name: 'Searching',
    pid: '',
    price: 'N/A',
    street: false,
    crimerate: 5,
    rating: 3.5,
  };
  public recommendedGarageParking: db_parkinglot = {
    availability: "N/A",
    coordinates: new firebase.firestore.GeoPoint(0, 0),
    name: 'Searching',
    pid: '',
    price: 'N/A',
    street: false,
    crimerate: 5,
    rating: 3.5,
  };
  // @ts-ignore
  public nearByParkinglots: Observable<db_parkinglot[]>;
  async ngOnInit() {
    this.recommend = true;
    this.currentLocation = new Point({
      longitude: -118.289329,
      latitude: 34.025599
    });
    this.nearByParkinglots = this.dbService.watchParkinglots();

    esriConfig.apiKey = "AAPTxy8BH1VEsoebNVZXo8HurJPd1YxuAvtilR4Oj-eMC3J8CTubEtg7vHQVygz7hKrV6bNd_j5sO5RIJcIIzCEtcWDt7OSN7meb12j0R68_aTm9RQ-faOdXi6npRvDfo_J6Ln0JekeLqt8yOAHWN7gRFObaYMXEagKgi8jPg1wZveKdhZvOHluM2bVMmYiDmScKDSJPFEqcougEyPZchppDVWe5rNfQaLEOIR7SR70kCDzac6kjxSLPMH1NUm3WYGXa64h88MWjbvs_lmqaCRKbVA..AT1_vbWtpZTG";

    const colors = ["rgba(115, 0, 115, 0)", "#820082", "#910091", "#a000a0", "#af00af", "#c300c3", "#d700d7", "#eb00eb", "#ff00ff", "#ff58a0", "#ff896b", "#ffb935", "#ffea00", "#ffea00", "#ffea00"]
    const url = "https://services8.arcgis.com/LLNIdHmmdjO2qQ5q/arcgis/rest/services/Hackathon_Map_5_WFL1/FeatureServer";
    const layer = new FeatureLayer({
      title: "Hackathon_Map_5_WFL1",
      url
    });

    layer.renderer = {
      type: "heatmap",
      // @ts-ignore
      colorStops: [
        { color: colors[0], ratio: 0 },
        { color: colors[1], ratio: 0.03 },
        { color: colors[2], ratio: 0.13 },
        { color: colors[3], ratio: 0.21 },
        { color: colors[4], ratio: 0.27 },
        { color: colors[5], ratio: 0.35 },
        { color: colors[6], ratio: 0.42 },
        { color: colors[7], ratio: 0.48 },
        { color: colors[8], ratio: 0.56 },
        { color: colors[9], ratio: 0.63 },
        { color: colors[10], ratio: 0.70 },
        { color: colors[11], ratio: 0.77 },
        { color: colors[12], ratio: 0.85 },
        { color: colors[13], ratio: 0.92 },
        { color: colors[14], ratio: 1 }
      ],
      radius: 20,
      maxDensity: 0.04625,
      minDensity: 0
    };

    const webmap = new WebMap({
      portalItem: {
        id: "29eeaa4b458740fca6145b3e67240de8",
      },
      layers: [layer]
    });

    this.view = new MapView({
      container: "map_canvas",
      map: webmap,
      zoom: 18,
      center: this.currentLocation,
      ui: {
        components: ["attribution"],

      }
    });

    this.zoomWidget = new Zoom({
      view: this.view,
      layout: "horizontal"
    });

    this.locatorWidget = document.getElementById("myOwnLocatorButton");
    this.locatorWidget?.addEventListener("click", async () => await this.locatorAction());
    this.view.ui.add(["myOwnLocatorButton", this.zoomWidget], "bottom-left");

    this.searchWidget = new Search({
      view: this.view,
      popupEnabled: false,
      resultGraphicEnabled: false
    });

    this.view.ui.add(this.searchWidget, "bottom-right");

    reactiveUtils.watch(
      () => [this.view.stationary, this.view.extent],
      async ([stationary, extent], [wasStationary]) => {
        if (stationary) {
          try {
            if (this.garage_recommend == this.garage_recommend_prev_value) {
              this.selected = false;
              if (!this.recommend) {
                this.recommend = true;
              }
              // @ts-ignore
              await this.findNearByParkinlotsService(extent.center, 4000);
              // @ts-ignore
              this.dbService.getNearByStreetParkinglots(extent.center);
            }
            else {
              this.garage_recommend_prev_value = this.garage_recommend;
            }
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
          this.removePreviousSelection();
          // @ts-ignore
          const selectedGraphic = response.results[0].graphic;
          if (selectedGraphic && selectedGraphic.attributes) {
            // @ts-ignore
            this.parkinglot = selectedGraphic.attributes;
            this.selectedParkinglots.push(this.parkinglot);
            this.updateSelectedGraphic(this.parkinglot);
            const index = Math.floor(Math.random() * 4) + 1;
            this.image = "../../assets/";
            if (this.parkinglot.street) {
              this.image += "street_" + index.toString() + ".png";
            }
            else {
              this.parking_lot = Math.floor(Math.random() * 2) == 1;
              if (this.parking_lot) {
                this.image += "lot_" + index.toString() + ".png";
              }
              else {
                this.image += "garage_" + index.toString() + ".png";
              }
            }
            this.selected = true;
            await this.parkinglotModal.dismiss();
            this.parkinglotModal.initialBreakpoint = 0.6;
            this.parkinglotModal.setCurrentBreakpoint(0.6);
            await this.parkinglotModal.present();
          }
        }
      });
    });

    // var parkings: any = await this.dbService.pullData();
    // console.log(parkings.length)
    // await this.dbService.pushData(parkings);
  }

  removePreviousSelection() {
    for (var i = 0; i < this.selectedParkinglots.length; i++) {
      this.addParkingLotGraphic(this.selectedParkinglots[i])
    }
  }

  updateSelectedGraphic(parkinglot: db_parkinglot) {
    var icon = "";
    var width = 0;
    var height = 0;
    if (parkinglot.street) {
      if (parkinglot.availability == 'VACANT') {
        icon = "../../assets/street_empty_selected.png";
      }
      else {
        icon = "../../assets/street_busy_selected.png"
      }
      width = 30;
      height = 30;
    }
    else {
      width = 50;
      height = 50;
      console.log(parkinglot.availability);
      switch (parkinglot.availability) {
        case "VACANT":
          icon = "../../assets/empty_selected.png";
          break;
        case "MEDIUM":
          icon = "../../assets/middle_selected.png";
          break;
        case "OCCUPIED":
          icon = "../../assets/busy_selected.png";
          break;
        case "N/A":
          icon = "../../assets/na_selected.png";
          break;
      }
    }
    var symbol = new PictureMarkerSymbol({
      "angle": 0, "xoffset": 0, "yoffset": 10, "url": icon, "width": width, "height": height, color: "black"
    });
    var selectedParkinglotIndex = this.view.graphics.toArray().findIndex(graphic => graphic.attributes.pid == parkinglot.pid);
    if (selectedParkinglotIndex != -1) {
      //@ts-ignore
      if (this.view.graphics.at(selectedParkinglotIndex).symbol?.url != symbol.url) {
        this.view.graphics.at(selectedParkinglotIndex).symbol = symbol;
      }
    }
    else {
      const parkinglotPoint = new Point({
        longitude: parkinglot.coordinates.longitude,
        latitude: parkinglot.coordinates.latitude
      });
      const iconGraphic = new Graphic({
        attributes: parkinglot,
        geometry: parkinglotPoint,
        symbol: symbol
      });
      this.view.graphics.add(iconGraphic);
    }
  }

  async locatorAction() {
    var gotoOption = {
      animate: true,
      duration: 600,
    };
    const position = await Geolocation.getCurrentPosition();
    const liveLocation = new Point({
      longitude: position.coords.longitude,
      latitude: position.coords.latitude
    });
    this.addCurrentAddressInfo(liveLocation);
    return this.view.goTo({
      target: liveLocation,
      zoom: 18
    }, gotoOption);
  }

  addCurrentAddressInfo(liveLocation: Point) {
    var symbol = new PictureMarkerSymbol({ "angle": 0, "xoffset": 0, "yoffset": 10, "url": "../../assets/current_location.png", "width": 30, "height": 30 });
    const currentPositionGraphic = new Graphic({
      geometry: liveLocation,
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
    const streetParkinglotSub = this.nearByParkinglots.pipe(debounceTime(1000)).subscribe(async parkinglots => {
      if (parkinglots) {

        // get street parking recommendation
        if (this.recommend) {
          console.log('get recommendation');
          const allStreetParkings = parkinglots.filter(parkinglot => parkinglot.street == true);
          const allGarageParkings = parkinglots.filter(parkinglot => parkinglot.street == false);
          this.recommendedStreetParking = this.determineRecommendation(allStreetParkings, true);
          this.recommendedGarageParking = this.determineRecommendation(allGarageParkings, false);
          if (this.recommendedStreetParking.pid == "default_parking_pid" && this.recommendedGarageParking.pid == "default_parking_pid") {
            this.recommendedStreetParking = parkinglots[0];
            this.recommendedGarageParking = parkinglots[0];
          }
          else if (this.recommendedStreetParking.pid == "default_parking_pid") {
            this.recommendedStreetParking = parkinglots[0];
          }
          else if (this.recommendedGarageParking.pid == "default_parking_pid") {
            this.recommendedGarageParking = parkinglots[0];
          }

          if (this.garage_recommend) {
            this.parkinglot = this.recommendedGarageParking;
          }
          else {
            this.parkinglot = this.recommendedStreetParking;
          }
          this.view.center = new Point({ latitude: this.parkinglot.coordinates.latitude, longitude: this.parkinglot.coordinates.longitude });
          this.removePreviousSelection();
          this.selectedParkinglots.push(this.parkinglot);
          this.updateSelectedGraphic(this.parkinglot);
        }
        setTimeout(() => {
          this.recommend = false;
        }, 1500);
        parkinglots = parkinglots.filter(lot => lot.pid != this.parkinglot.pid);
        for (var i = 0; i < parkinglots.length; i++) {
          this.addParkingLotGraphic(parkinglots[i]);
          if ((i + 1) % 100 == 0) {
            await this.sleep(3000);
          }
        }
      }
    });

    await this.findNearByParkinlotsService(this.view.center, 4000);
    this.dbService.getNearByStreetParkinglots(this.view.center);
    this.allSubscription.push(streetParkinglotSub);
  }

  async findNearByParkinlotsService(point: Point, radius: number) {
    var parkingID = "19020";
    var searchCount = 20;
    var token = "AAPTxy8BH1VEsoebNVZXo8HurOvDojB09Xw7ZKgOZin7PquaH18eTQ-TQSqSDDNG73OJDJHjCRgLUvxKB3LOA6jZkcjALEZ7a7OMX1L15vhxTjA5fxufOpGu30RIkEeOrAGik-shuIBVx2-EeRVkswUaDtkWZQ7kaMyF8UWnPeojH9R4IX3oX28U310k-at-EDGzEQZvrJ0hyhWDYlBrF1AiCDwacVMC3Qv1VwJr-x5QrqY.AT1_Tk6GGjYD";
    var url = "https://places-api.arcgis.com/arcgis/rest/services/places-service/v1/places/near-point?f=json&x=" + point.longitude + "&y=" + point.latitude + "&radius=" + radius + "&categoryIds=" + parkingID + "&pageSize=" + searchCount + "&token=" + token;
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
          var parkingLot: db_parkinglot = {
            availability: "N/A",
            coordinates: new firebase.firestore.GeoPoint(parkingLots[i].location.y, parkingLots[i].location.x),
            name: parkingLots[i].name,
            pid: parkingLots[i].placeId,
            price: "N/A",
            street: false,
            crimerate: Math.floor(Math.random() * 5) + 1,
            rating: parseFloat((Math.random() * (5 - 1) + 1).toFixed(2))
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
    var icon = "";
    var width = 0;
    var height = 0;
    if (parkinglot.street) {
      if (parkinglot.availability == 'VACANT') {
        icon = "../../assets/street_empty.png";
      }
      else {
        icon = "../../assets/street_busy.png"
      }
      width = 30;
      height = 30;
    }
    else {
      width = 50;
      height = 50;
      console.log(parkinglot.availability);
      switch (parkinglot.availability) {
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
    else {
      var currentParkinglotIndex = this.view.graphics.toArray().findIndex(graphic => graphic.attributes.pid == parkinglot.pid);
      if (currentParkinglotIndex != -1) {
        //@ts-ignore
        if (this.view.graphics.at(currentParkinglotIndex).symbol?.url != symbol.url) {
          this.view.graphics.at(currentParkinglotIndex).symbol = symbol;
        }
      }
    }
    return iconGraphic;
  }

  async navigator() {
    const maps = this.plt.is('ios') ? "Apple" : "Google"
    const alert = await this.alertCtrl.create({
      header: 'Please take our survey after you arrive to help other people ParkSmart!',
      message: 'Open ' + maps + ' Map?',
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
          handler: async () => {
            this.launchNavigator();
            await this.presentActionSheet();
          }
        }
      ],
    });
    await alert.present();
  }

  launchNavigator() {
    const destination = [this.parkinglot.coordinates.latitude, this.parkinglot.coordinates.longitude];
    this.launchNav.navigate(destination, { app: this.plt.is('ios') ? this.launchNav.APP.APPLE_MAP : this.launchNav.APP.GOOGLE_MAPS }).then(() => { }).catch(err => {
    });
  }

  async presentActionSheet() {
    await this.parkinglotModal.dismiss();
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'How busy is the parking area?',
      mode: 'ios',
      cssClass: 'survey',
      buttons: [
        {
          text: 'Busy',
          role: 'destructive',
          handler: async () => {
            this.surveyData = {
              availability: "OCCUPIED",
              pid: this.parkinglot.pid
            }
            this.submitSurvey123(this.surveyData);
          }
        },
        {
          text: 'Medium',
          cssClass: 'medium',
          handler: async () => {
            this.surveyData = {
              availability: "MEDIUM",
              pid: this.parkinglot.pid
            }
            this.submitSurvey123(this.surveyData);
          }
        },
        {
          text: 'Vacant',
          cssClass: 'vacant',
          handler: async () => {
            this.surveyData = {
              availability: "VACANT",
              pid: this.parkinglot.pid
            }
            this.submitSurvey123(this.surveyData);
          }
        },
      ],
    });
    actionSheet.onDidDismiss().then(async () => {
      await this.parkinglotModal.present();
    });
    await actionSheet.present();
  }

  async submitSurvey123(data: SurveyData) {
    this.postSurveyResponse(data)
  }

  async get_survey_token() {
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
      return data.token;
    } catch (error) {
      console.error("Error:", error);
      return null;
    }
  }

  async postSurveyResponse(data: SurveyData): Promise<void> {
    const token = await this.get_survey_token();
    if (!token) {
      throw new Error("Failed to retrieve token");
    }

    const url = `https://services8.arcgis.com/LLNIdHmmdjO2qQ5q/ArcGIS/rest/services/survey123_f6e0d0f944d44d70bd1bed0b120d1de5_form/FeatureServer/0/applyEdits?token=${token}`;
    const bodyData = {
      f: 'json',
      adds: JSON.stringify([{
        attributes: {
          pid: data.pid,
          untitled_question_1: data.availability
        },
        geometry: {
          spatialReference: {
            wkid: 4326
          },
          x: 0,
          y: 0
        }
      }]),
      useGlobalIds: false,
      rollbackOnFailure: true,
      editsUploadFormat: "json"
    };
    const formBody = new URLSearchParams(bodyData as any).toString();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formBody
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
    } catch (error) {
      console.error('Error:', error);
    }
  }

  determineDistance(long: number, lat: number): number {
    const R = 6371000;
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
    const o1 = toRadians(this.view.center.latitude);
    const o2 = toRadians(lat);
    const du = toRadians(lat - this.view.center.latitude);
    const dh = toRadians(long - this.view.center.longitude);
    const a = Math.sin(du / 2) * Math.sin(du / 2) +
      Math.cos(o1) * Math.cos(o2) *
      Math.sin(dh / 2) * Math.sin(dh / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  }

  determineRecommendation(parkingLots: db_parkinglot[], isStreet: boolean) {
    var scoreArray = new Array();
    var priceArray = new Array();
    var distanceArray = new Array();
    var crimeArray = new Array();
    var busyArray = new Array();
    var ratingArray = new Array();

    for (var i = 0; i < parkingLots.length; i++) {
      priceArray.push(parkingLots[i].price == "N/A" ? 0 : parseFloat(parkingLots[i].price.substring(1)));
      distanceArray.push(this.determineDistance(parkingLots[i].coordinates.longitude, parkingLots[i].coordinates.latitude));
      crimeArray.push(parkingLots[i].crimerate);
      ratingArray.push(5.0 - parkingLots[i].rating);

      if (parkingLots[i].availability == "VACANT") {
        busyArray.push(1);
      }
      else if (parkingLots[i].availability == "MEDIUM") {
        busyArray.push(0.5);
      }
      else if (parkingLots[i].availability == "OCCUPIED") {
        busyArray.push(parkingLots[i].street ? -1 : 0);
      }
      else {
        busyArray.push(0.25);
      }
    }

    for (var i = 0; i < parkingLots.length; i++) {

      var busyScore = ((Math.max(...busyArray) - busyArray[i]) / (0.0001 + (Math.max(...busyArray) - Math.min(...busyArray))));

      var priceScore = ((Math.max(...priceArray) - priceArray[i]) / (0.0001 + (Math.max(...priceArray) - Math.min(...priceArray))));

      var distanceScore = ((Math.max(...distanceArray) - distanceArray[i]) / (0.0001 + (Math.max(...distanceArray) - Math.min(...distanceArray))));

      var crimeScore = ((Math.max(...crimeArray) - crimeArray[i]) / (0.0001 + (Math.max(...crimeArray) - Math.min(...crimeArray))));

      var ratingScore = ((Math.max(...ratingArray) - ratingArray[i]) / (0.0001 + (Math.max(...ratingArray) - Math.min(...ratingArray))));

      var acumulatedScore = ((0.1 * priceScore) + (0.15 * ratingScore) + (0.2 * crimeScore) + (0.25 * distanceScore) + (0.30 * busyScore));

      scoreArray.push(busyArray[i] == -1 ? -1 : acumulatedScore);
    }

    for (var i = 0; i < scoreArray.length; i++) {
      if (scoreArray[i] == Math.max(...scoreArray)) {
        return parkingLots[i];
      }
    }
    const default_parking_lot: db_parkinglot = {
      availability: "N/A",
      coordinates: new firebase.firestore.GeoPoint(this.currentLocation.latitude, this.currentLocation.longitude),
      crimerate: 5,
      name: "Sorry no parking found",
      pid: "default_parking_pid",
      price: "N/A",
      rating: 0,
      street: isStreet
    }
    return default_parking_lot;
  }

  // toggle change for recommendation
  toggleChange($event: any) {
    this.removePreviousSelection();
    if ($event.detail.checked) {
      this.parkinglot = this.recommendedGarageParking;
    }
    else {
      this.parkinglot = this.recommendedStreetParking;
    }
    this.view.center = new Point({ latitude: this.parkinglot.coordinates.latitude, longitude: this.parkinglot.coordinates.longitude });
    this.selectedParkinglots.push(this.parkinglot);
    this.updateSelectedGraphic(this.parkinglot);
  }

  async viewRecommendation() {
    await this.parkinglotModal.dismiss();
    this.selected = true;
    const index = Math.floor(Math.random() * 4) + 1;
    this.image = "../../assets/";
    if (this.parkinglot.street) {
      this.image += "street_" + index.toString() + ".png";
    }
    else {
      this.parking_lot = Math.floor(Math.random() * 2) == 1;
      if (this.parking_lot) {
        this.image += "lot_" + index.toString() + ".png";
      }
      else {
        this.image += "garage_" + index.toString() + ".png";
      }
    }
    this.parkinglotModal.initialBreakpoint = 0.6;
    this.parkinglotModal.setCurrentBreakpoint(0.6);
    await this.parkinglotModal.present();
  }

}
