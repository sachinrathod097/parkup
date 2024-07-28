fetch = require('node-fetch');
const getRating = (lat, lng) => {
    const params = {
        "location": lat + "," + lng,
        "radius": 1,
        "key": AIzaSyDZSv7H2rnmSZimbF3SMwVQU_FtXoXaQPg
    }
    fetch('https://maps.googleapis.com/maps/api/place/nearbysearch/json', { params })
      .pipe(
        map(response => {
          const places = response.results;
          if (places.length > 0 && places[0].rating !== undefined) {
            return places[0].rating;
          } else {
            return -1;
          }
        }),
        catchError(error => {
          console.error('Error fetching place rating:', error);
          return [-1];
        })
      )
  }