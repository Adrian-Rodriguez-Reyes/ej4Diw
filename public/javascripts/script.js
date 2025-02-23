var map = L.map('map').setView([0, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

L.Control.NearestPoint = L.Control.extend({
  onAdd: function(map) {
    var btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
    btn.innerHTML = 'Punto de interes más cercano';
    btn.style.backgroundColor = 'white';
    btn.style.width = '200px';
    btn.style.height = '30px';
    btn.onclick = function() {
      showNearestPoint();
    };
    return btn;
  }
});
L.control.nearestPoint = function(opts) {
  return new L.Control.NearestPoint(opts);
}
L.control.nearestPoint({ position: 'topright' }).addTo(map);

let points = [];
let editIndex = null;

function initializeApp() {
  fetch('/javascripts/points.geojson')
    .then(response => response.json())
    .then(data => {
      const geoPoints = data.features.map(feature => ({
        title: feature.properties.title,
        description: feature.properties.description,
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        categoria: feature.properties.categoria,
        foto: feature.properties.foto,
        isSystem: true 
      }));

      const userPoints = JSON.parse(sessionStorage.getItem('userPoints')) || [];
      points = [...geoPoints, ...userPoints];
      
      refreshMap();
      updateTable();

      if (points.length > 0) {
        const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    })
    .catch(error => {
      console.error('Error cargando puntos:', error);
      const userPoints = JSON.parse(sessionStorage.getItem('userPoints')) || [];
      points = userPoints;
      refreshMap();
      updateTable();
    });
}

function saveToSessionStorage() {
  const userPoints = points.filter(point => !point.isSystem);
  sessionStorage.setItem('userPoints', JSON.stringify(userPoints));
}

function addMarker(point, index) {
  const popupContent = `
    <div class="popup-content text-center position-relative">
      <h5 class="mb-1">${point.title}</h5>
      <p><b>Descripción:</b> ${point.description}</p>
      <p><b>Latitud:</b> ${point.lat}</p>
      <p><b>Longitud:</b> ${point.lng}</p>
      <p><b>Categoría:</b> ${point.categoria}</p>
      <div class="position-relative d-inline-block">
        <img src="${point.foto}" alt="${point.title}" class="img-fluid rounded" style="max-width: 150px; cursor: pointer;" onclick="showImageModal('${point.foto}', '${point.title}')">
      </div>
    </div>
  `;
  const marker = L.marker([point.lat, point.lng]).addTo(map)
    .bindPopup(popupContent);
  marker._leaflet_id = `marker-${index}`;
}

function refreshMap() {
  map.eachLayer(layer => {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });
  points.forEach((point, index) => addMarker(point, index));
}

function updateTable() {
  const tbody = document.querySelector('#tablaPuntos tbody');
  tbody.innerHTML = '';
  points.forEach((point, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td id="row-${index}">${point.title}</td>
      <td>${point.lat}</td>
      <td>${point.lng}</td>
      <td>${point.categoria}</td>
      <td>
        <button class="btn btn-warning btn-sm" onclick="showEditModal(${index})" ${point.isSystem ? 'disabled' : ''}>Editar</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeletePoint(${index})" ${point.isSystem ? 'disabled' : ''}>Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);

    document.getElementById(`row-${index}`).addEventListener('mouseover', () => {
      const marker = map._layers[`marker-${index}`];
      if (marker) marker.openPopup();
    });
  });
}

function showImageModal(src, title) {
  document.getElementById('modalImage').src = src;
  document.getElementById('imageModalLabel').innerText = title;
  new bootstrap.Modal(document.getElementById('imageModal')).show();
}

function confirmDeletePoint(index) {
  const point = points[index];
  if (point.isSystem) {
    swal({
      title: "Operación no permitida",
      text: "No se pueden eliminar los puntos predefinidos del sistema",
      icon: "warning",
      button: "Entendido"
    });
    return;
  }
  
  swal({
    title: "¿Estás seguro?",
    text: "¡Una vez eliminado, no podrás recuperar este punto de interés!",
    icon: "warning",
    buttons: ["Cancelar", "Sí, eliminar"],
    dangerMode: true,
  }).then(willDelete => {
    if (willDelete) {
      deletePoint(index);
      swal("¡Punto eliminado!", "El punto de interés ha sido eliminado correctamente.", "success");
    }
  });
}

function deletePoint(index) {
  points.splice(index, 1);
  refreshMap();
  updateTable();
  saveToSessionStorage();
}

function showEditModal(index) {
  const point = points[index];
  if (point.isSystem) {
    swal({
      title: "Operación no permitida",
      text: "No se pueden modificar los puntos predefinidos del sistema",
      icon: "warning",
      button: "Entendido"
    });
    return;
  }

  editIndex = index;
  document.getElementById('editTitulo').value = point.title;
  document.getElementById('editDescripcion').value = point.description;
  document.getElementById('editLat').value = point.lat;
  document.getElementById('editLng').value = point.lng;
  document.getElementById('editCategoria').value = point.categoria;
  document.getElementById('editModal').removeAttribute('hidden');
}

document.getElementById('closeModal').addEventListener('click', () => {
  document.getElementById('editModal').setAttribute('hidden', '');
});

document.getElementById('formPunto').addEventListener('submit', function(event) {
  event.preventDefault();
  const title = document.getElementById('titulo').value.trim();
  const description = document.getElementById('descripcion').value.trim();
  const lat = document.getElementById('lat').value.trim();
  const lng = document.getElementById('lng').value.trim();
  const categoria = document.getElementById('categoria').value.trim();
  const foto = document.getElementById('foto').files[0];

  if (!title || !description || !lat || !lng || !categoria || !foto) {
    swal({
      title: "Campos faltantes",
      text: "Complete todos los campos",
      icon: "warning",
      button: "Aceptar"
    });
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const newPoint = {
      title,
      description,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      categoria,
      foto: e.target.result,
      isSystem: false
    };

    points.push(newPoint);
    refreshMap();
    updateTable();
    saveToSessionStorage();
    document.getElementById('formPunto').reset();
    swal("¡Éxito!", "Punto añadido correctamente", "success");
  };
  reader.readAsDataURL(foto);
});

document.getElementById('formEditPunto').addEventListener('submit', function(event) {
  event.preventDefault();
  const point = points[editIndex];
  if (point.isSystem) {
    swal({
      title: "Operación no permitida",
      text: "No se pueden modificar los puntos predefinidos del sistema",
      icon: "warning",
      button: "Entendido"
    });
    return;
  }

  const title = document.getElementById('editTitulo').value;
  const description = document.getElementById('editDescripcion').value;
  const lat = parseFloat(document.getElementById('editLat').value);
  const lng = parseFloat(document.getElementById('editLng').value);
  const categoria = document.getElementById('editCategoria').value;
  const fotoFile = document.getElementById('editFoto').files[0];

  if (fotoFile && fotoFile.size > 0) {
    const reader = new FileReader();
    reader.onload = function(e) {
      points[editIndex] = {
        title,
        description,
        lat,
        lng,
        categoria,
        foto: e.target.result,
        isSystem: point.isSystem
      };
      editIndex = null;
      refreshMap();
      updateTable();
      saveToSessionStorage();
      document.getElementById('editModal').setAttribute('hidden', '');
      swal("¡Éxito!", "Cambios guardados correctamente", "success");
    };
    reader.readAsDataURL(fotoFile);
  } else {
    points[editIndex] = {
      title,
      description,
      lat,
      lng,
      categoria,
      foto: point.foto,
      isSystem: point.isSystem
    };
    editIndex = null;
    refreshMap();
    updateTable();
    saveToSessionStorage();
    document.getElementById('editModal').setAttribute('hidden', '');
    swal("¡Éxito!", "Cambios guardados correctamente", "success");
  }
});

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon1 - lon2) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNearestPoint(userLat, userLng, category) {
  let nearestPoint = null;
  let minDistance = Infinity;
  points.forEach(point => {
    if (point.categoria === category || category === "") {
      const distance = haversineDistance(userLat, userLng, point.lat, point.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
      }
    }
  });
  return nearestPoint;
}

function showNearestPoint() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      const selectedCategory = document.getElementById('categoria').value;
      const nearestPoint = findNearestPoint(userLat, userLng, selectedCategory);
      if (nearestPoint) {
        const popupContent = `
          <div class="text-center position-relative">
            <h5 class="mb-1">${nearestPoint.title}</h5>
            <p><b>Descripción:</b> ${nearestPoint.description}</p>
            <p><b>Latitud:</b> ${nearestPoint.lat}</p>
            <p><b>Longitud:</b> ${nearestPoint.lng}</p>
            <p><b>Categoría:</b> ${nearestPoint.categoria}</p>
            <div class="position-relative d-inline-block">
              <img src="${nearestPoint.foto}" alt="${nearestPoint.title}" class="img-fluid rounded" style="max-width: 150px; cursor: pointer;" onclick="showImageModal('${nearestPoint.foto}', '${nearestPoint.title}')">
            </div>
          </div>
        `;
        L.popup().setLatLng([nearestPoint.lat, nearestPoint.lng]).setContent(popupContent).openOn(map);
      }
    }, error => {
      console.error("Error obteniendo la ubicación:", error);
    });
  } else {
    console.error("Geolocation no está soportado por este navegador.");
  }
}

document.addEventListener('DOMContentLoaded', function() {
  initializeApp();

  const filtroCategoria = document.getElementById('filtroCategoria');
  filtroCategoria.addEventListener('change', function() {
    const selectedCategory = this.value;
    localStorage.setItem('selectedCategory', selectedCategory);
    filterPointsByCategory(selectedCategory);
  });
});

function filterPointsByCategory(category) {
  map.eachLayer(layer => {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });
  const filteredPoints = category ? points.filter(point => point.categoria === category) : points;
  filteredPoints.forEach((point, index) => addMarker(point, index));
  if (filteredPoints.length > 0) {
    const bounds = L.latLngBounds(filteredPoints.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds);
  }
}
