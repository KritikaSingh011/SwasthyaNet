const CLOUD_API_KEY = import.meta.env.VITE_MAPS_API_KEY || "AIzaSyDWphMdDlErc_Zl6ZWVQZXThG_wppxdLnU";

let mapsLoaded = false;

/**
 * Dynamically loads the Google Maps Platform JS SDK
 */
export function loadGoogleMaps(callback) {
  if (mapsLoaded) {
    if (callback) callback();
    return;
  }
  
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${CLOUD_API_KEY}&libraries=visualization&callback=initSwasthyaMaps`;
  script.async = true;
  script.defer = true;
  
  window.initSwasthyaMaps = () => {
    mapsLoaded = true;
    if (callback) callback();
  };
  
  document.head.appendChild(script);
}

/**
 * Renders an interactive Google Map with the clinician check-in and facility geofence bounds
 */
export function renderAttendanceMap(container, clinicianLat, clinicianLng, facilityLat, facilityLng, geofenceRadius = 400) {
  loadGoogleMaps(() => {
    const center = { lat: (clinicianLat + facilityLat) / 2, lng: (clinicianLng + facilityLng) / 2 };
    const map = new google.maps.Map(container, {
      zoom: 15,
      center: center,
      mapId: "SWASTHYANET_CHECKIN_MAP"
    });

    // Place Facility Marker
    new google.maps.Marker({
      position: { lat: facilityLat, lng: facilityLng },
      map: map,
      title: "Health Center Location",
      icon: {
        url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
      }
    });

    // Place Clinician Marker
    new google.maps.Marker({
      position: { lat: clinicianLat, lng: clinicianLng },
      map: map,
      title: "Clinician Checked-in Location",
      icon: {
        url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
      }
    });

    // Draw Geofencing Boundary Circle
    new google.maps.Circle({
      strokeColor: "#1B4B43",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: "#BFDCD3",
      fillOpacity: 0.35,
      map: map,
      center: { lat: facilityLat, lng: facilityLng },
      radius: geofenceRadius
    });
  });
}

/**
 * Renders a Heatmap overlay showing local health issues/hotspots using GMaps Heatmap Layer
 */
export function renderHotspotsMap(container, casesList) {
  loadGoogleMaps(() => {
    const map = new google.maps.Map(container, {
      zoom: 11,
      center: { lat: 26.8467, lng: 80.9462 }, // Lucknow District Center
      mapTypeId: "roadmap"
    });

    const heatmapData = casesList.map(c => {
      return new google.maps.LatLng(c.lat, c.lng);
    });

    new google.maps.visualization.HeatmapLayer({
      data: heatmapData,
      map: map,
      radius: 30
    });
  });
}
