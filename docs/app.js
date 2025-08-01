// Initialize the map
var map = L.map('map').setView([0, 0], 2);

// Base layers
var baseLayers = {
  "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }),
  "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri'
  })
};

// Add default base layer
baseLayers["OpenStreetMap"].addTo(map);

// Helper to wrap longitude into the legal –180 … 180 range
function wrapLon(lon) {
  return ((lon + 180) % 360 + 360) % 360 - 180;
}

// Layer control for basemaps
L.control.layers(baseLayers).addTo(map);

// Feature Group to store editable layers
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Layer Group to store point markers
var pointMarkers = L.layerGroup().addTo(map);

// Initialize the draw control
var drawControl = new L.Control.Draw({
  draw: {
    polyline: false,
    rectangle: false,
    circle: false,
    marker: false,
    circlemarker: false
  },
  edit: {
    featureGroup: drawnItems
  }
});
map.addControl(drawControl);

var userPolygon;

// When a polygon is created …
map.on(L.Draw.Event.CREATED, function (e) {
  drawnItems.clearLayers();
  userPolygon = e.layer;
  drawnItems.addLayer(userPolygon);
  document.getElementById('downloadBtn').disabled = false;

  // Show popup asking the user to download points
  var centroid = turf.centroid(userPolygon.toGeoJSON()).geometry.coordinates;
  var popupContent =
    '<div style="text-align:center;">' +
      '<p>Download random points in this region?</p>' +
      '<button id="popupDownloadBtn" class="btn btn-primary btn-sm">Download</button>' +
    '</div>';

  var popup = L.popup()
    .setLatLng([centroid[1], centroid[0]])
    .setContent(popupContent)
    .openOn(map);

  // Attach click handler to popup button once it exists
  setTimeout(function () {
    var btn = document.getElementById('popupDownloadBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        document.getElementById('downloadBtn').click(); // trigger normal download flow
        map.closePopup(popup);
      });
    }
  }, 0);

  // Clear existing point markers
  pointMarkers.clearLayers();
});

// Random-point generator
function generateRandomPoints(polygon, numPoints) {
  var points = [];
  var maxIterations = 10;
  var iterations = 0;

  var bbox = turf.bbox(polygon);
  var minX = bbox[0];
  var minY = bbox[1];
  var maxX = bbox[2];
  var maxY = bbox[3];

  var longitudesCrossAntimeridian = minX > maxX;
  if (longitudesCrossAntimeridian) maxX += 360;

  while (points.length < numPoints && iterations < maxIterations) {
    var pointsToGenerate = (numPoints - points.length) * 5; // oversample
    var randomPoints = { type: "FeatureCollection", features: [] };

    for (var i = 0; i < pointsToGenerate; i++) {
      var randX = minX + Math.random() * (maxX - minX);
      // Wrap longitude into valid range
      randX = wrapLon(randX);
      var randY = minY + Math.random() * (maxY - minY);

      randomPoints.features.push(turf.point([randX, randY]));
    }

    // Keep only points inside the polygon
    var ptsWithin = turf.pointsWithinPolygon(randomPoints, polygon);
    ptsWithin.features.forEach(function (pt) {
      if (points.length < numPoints) points.push(pt.geometry.coordinates);
    });
    iterations++;
  }

  if (points.length < numPoints) {
    alert('Could not generate the desired number of points within the selected area. Try a larger polygon or fewer points.');
  }
  return points;
}

// Download the points as CSV
function downloadCSV(points) {
  var csvContent = "point_number,latitude,longitude\n";
  points.forEach(function (point, index) {
    csvContent += (index + 1) + "," + point[1] + "," + wrapLon(point[0]) + "\n";
  });
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, 'random_points.csv');
}

// Plot points on the map
function plotPointsOnMap(points) {
  pointMarkers.clearLayers();
  var latLngs = [];

  points.forEach(function (coord) {
    var marker = L.circleMarker([coord[1], wrapLon(coord[0])], {
      radius: 5,
      fillColor: '#ff7800',
      color: '#000',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    });
    pointMarkers.addLayer(marker);
    latLngs.push([coord[1], wrapLon(coord[0])]);
  });

  if (latLngs.length) map.fitBounds(L.latLngBounds(latLngs));
}

// Instructions modal
var instructionsModal = new bootstrap.Modal(document.getElementById('instructionsModal'));
document.getElementById('instructionsBtn').addEventListener('click', function () {
  instructionsModal.show();
});

// Report Issue button
document.getElementById('reportIssueBtn').addEventListener('click', function () {
  window.open('https://github.com/wincowgerDEV/mapRPG/issues', '_blank');
});

// Main “Download CSV” button
document.getElementById('downloadBtn').addEventListener('click', function () {
  if (!userPolygon) {
    alert('Please draw a polygon first.');
    return;
  }

  var geojson = userPolygon.toGeoJSON();
  var numPointsInput = document.getElementById('numPoints').value;
  var numPoints = parseInt(numPointsInput, 10);

  if (isNaN(numPoints) || numPoints < 1) {
    alert('Please enter a valid number of points (minimum 1).');
    return;
  }

  var points = generateRandomPoints(geojson.geometry, numPoints);
  downloadCSV(points);
  plotPointsOnMap(points);
});
