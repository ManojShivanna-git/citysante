import { useRef, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { WebView } from 'react-native-webview'
import * as Location from 'expo-location'

const GOOGLE_MAPS_KEY = 'AIzaSyDomYDJ9arv0ZY4DM-CYChxPTmV82QgBBw'
// Default center — Bangalore
const DEFAULT_LAT = 12.9716
const DEFAULT_LNG = 77.5946

interface Props {
  onLocationSelect: (lat: number, lng: number) => void
  initialLat?: number
  initialLng?: number
}

export default function InlineMapPicker({ onLocationSelect, initialLat, initialLng }: Props) {
  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const webRef = useRef<WebView>(null)

  const centerLat = initialLat || DEFAULT_LAT
  const centerLng = initialLng || DEFAULT_LNG

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; font-family: sans-serif; }
    #map { width: 100%; height: 100%; }

    #search-box {
      position: absolute; top: 8px; left: 8px; right: 8px; z-index: 10;
      display: flex; gap: 6px;
    }
    #search-input {
      flex: 1; padding: 8px 12px; border-radius: 8px; border: 1.5px solid #e5e7eb;
      font-size: 13px; background: #fff; outline: none;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    #search-btn {
      padding: 8px 12px; background: #f97316; color: #fff; border: none;
      border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    #blocking-overlay {
      display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.55);
      z-index: 999; align-items: center; justify-content: center;
      flex-direction: column; gap: 10; color: #fff; font-size: 14px; font-weight: 700;
    }
    #blocking-overlay.active { display: flex; }
    #hint {
      position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.6); color: #fff; font-size: 11px;
      padding: 4px 12px; border-radius: 20px; white-space: nowrap; z-index: 10;
      pointer-events: none;
    }
    #my-loc-btn {
      position: absolute; top: 56px; right: 8px; z-index: 10;
      width: 40px; height: 40px; background: #fff; border: none; border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25); cursor: pointer;
      display: flex; align-items: center; justify-content: center; padding: 0;
      font-size: 20px; line-height: 1;
    }
  </style>
</head>
<body>
  <div id="search-box">
    <input id="search-input" type="text" placeholder="Search your shop address…" />
    <button id="search-btn" onclick="doSearch()">Go</button>
  </div>
  <div id="blocking-overlay"><div>⏳</div><div>Getting your location...</div></div>
  <div id="hint">Tap the map to pin your shop</div>
  <button id="my-loc-btn" onclick="goToMyLocation()" title="My location">📍</button>
  <div id="map"></div>

  <script>
    var marker = null;
    var map = null;
    var geocoder = null;
    var autocomplete = null;

    function initMap() {
      geocoder = new google.maps.Geocoder();

      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: ${centerLat}, lng: ${centerLng} },
        zoom: 16,
        disableDefaultUI: true,
        zoomControl: true,
      });

      // Places autocomplete on the search input
      autocomplete = new google.maps.places.Autocomplete(
        document.getElementById('search-input'),
        { componentRestrictions: { country: 'in' } }
      );
      autocomplete.addListener('place_changed', function() {
        var place = autocomplete.getPlace();
        if (!place.geometry) { doSearch(); return; }
        var loc = place.geometry.location;
        map.setCenter(loc);
        map.setZoom(17);
        placeMarker(loc.lat(), loc.lng());
      });

      ${initialLat ? `
      placeMarker(${initialLat}, ${initialLng});
      ` : `
      // Auto-get current location on load
      goToMyLocation();
      `}

      map.addListener('click', function(e) {
        placeMarker(e.latLng.lat(), e.latLng.lng());
      });
    }

    function getIcon() {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">' +
        '<ellipse cx="20" cy="47" rx="8" ry="3" fill="rgba(0,0,0,0.2)"/>' +
        '<path d="M20 2 C10 2 4 10 4 18 C4 30 20 45 20 45 C20 45 36 30 36 18 C36 10 30 2 20 2Z" fill="#e53935" stroke="#fff" stroke-width="2"/>' +
        '<circle cx="20" cy="18" r="9" fill="#fff"/>' +
        '<text x="20" y="23" text-anchor="middle" font-size="12" fill="#e53935">🏪</text>' +
        '</svg>';
      return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), scaledSize: new google.maps.Size(40, 50), anchor: new google.maps.Point(20, 47) };
    }

    function placeMarker(lat, lng) {
      var pos = { lat: lat, lng: lng };
      if (marker) {
        marker.setPosition(pos);
      } else {
        marker = new google.maps.Marker({
          position: pos, map: map, draggable: true,
          animation: google.maps.Animation.DROP,
          icon: getIcon()
        });
        marker.addListener('dragend', function(e) {
          sendCoords(e.latLng.lat(), e.latLng.lng());
        });
        document.getElementById('hint').style.display = 'none';
      }
      sendCoords(lat, lng);
    }

    function doSearch() {
      var q = document.getElementById('search-input').value.trim();
      if (!q) return;
      geocoder.geocode({ address: q + ', India' }, function(results, status) {
        if (status === 'OK' && results[0]) {
          var loc = results[0].geometry.location;
          map.setCenter(loc);
          map.setZoom(17);
          placeMarker(loc.lat(), loc.lng());
        }
      });
    }

    function goToMyLocation() {
      document.getElementById('my-loc-btn').textContent = '⏳';
      document.getElementById('blocking-overlay').classList.add('active');
      if (marker) marker.setDraggable(false);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MY_LOCATION' }));
    }

    function sendCoords(lat, lng) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng }));
    }

    document.getElementById('search-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') doSearch();
    });
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&callback=initMap" async defer></script>
</body>
</html>`

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator color="#f97316" />
          <Text style={styles.loaderText}>Loading map…</Text>
        </View>
      )}
      <WebView
        ref={webRef}
        source={{ html }}
        style={styles.map}
        onLoadEnd={() => setLoading(false)}
        onMessage={async (e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data)
            if (msg.type === 'MY_LOCATION') {
              setLocating(true)
              try {
                const { status } = await Location.requestForegroundPermissionsAsync()
                if (status !== 'granted') return
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
                const lat = loc.coords.latitude
                const lng = loc.coords.longitude
                webRef.current?.injectJavaScript(`
                  map.setCenter({ lat: ${lat}, lng: ${lng} });
                  map.setZoom(17);
                  placeMarker(${lat}, ${lng});
                  document.getElementById('my-loc-btn').textContent = '📍';
                  document.getElementById('blocking-overlay').classList.remove('active');
                  if (marker) marker.setDraggable(true);
                  true;
                `)
                onLocationSelect(lat, lng)
              } finally {
                setLocating(false)
              }
            } else {
              onLocationSelect(msg.lat, msg.lng)
            }
          } catch {}
        }}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { height: 300, borderRadius: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: '#e5e7eb', marginBottom: 16 },
  map:       { flex: 1 },
  loader:    { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', gap: 8 },
  loaderText:      { fontSize: 12, color: '#9ca3af' },
  locatingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 999 },
  locatingText:    { color: '#fff', fontSize: 13, fontWeight: '600' },
})
