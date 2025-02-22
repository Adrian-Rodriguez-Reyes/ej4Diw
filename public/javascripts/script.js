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

localStorage.removeItem('userPoints');

fetch('/javascripts/points.json')
    .then(response => response.json())
    .then(data => {
      points = data;
      points.forEach(addMarker);
      updateTable();
    });


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

function showImageModal(src, title) {
  document.getElementById('modalImage').src = src;
  document.getElementById('imageModalLabel').innerText = title;
  var imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
  imageModal.show();
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
        <button class="btn btn-warning btn-sm" onclick="showEditModal(${index})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeletePoint(${index}, true)">Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);

    // Add mouseover event to show popup
    document.getElementById(`row-${index}`).addEventListener('mouseover', function () {
      const marker = map._layers[`marker-${index}`];
      if (marker) {
        marker.openPopup();
      }
    });
  });
}
function confirmDeletePoint(index, isInitial) {
  swal({
    title: "¿Estás seguro?",
    text: "¡Una vez eliminado, no podrás recuperar este punto de interés!",
    icon: "warning",
    buttons: true,
    dangerMode: true,
  })
      .then((willDelete) => {
        if (willDelete) {
          deletePoint(index, isInitial);
          swal("¡Listo! Tu punto de interés ha sido eliminado.", {
            icon: "success",
          });
        } else {
          swal("¡Tu punto de interés está a salvo!");
        }
      });
}

function deletePoint(index, isInitial) {
  points.splice(index, 1);
  updateTable();
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });
  points.forEach(addMarker);
}

function showEditModal(index) {
  const point = points[index];
  document.getElementById('editTitulo').value = point.title;
  document.getElementById('editDescripcion').value = point.description;
  document.getElementById('editLat').value = point.lat;
  document.getElementById('editLng').value = point.lng;
  document.getElementById('editCategoria').value = point.categoria;
  editIndex = index;

  document.getElementById('editModal').removeAttribute('hidden');
}

document.getElementById('closeModal').addEventListener('click', function () {
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

  let missingFields = [];

  if (!title) missingFields.push('Título');
  if (!description) missingFields.push('Descripción');
  if (!lat) missingFields.push('Latitud');
  if (!lng) missingFields.push('Longitud');
  if (!categoria) missingFields.push('Categoría');
  if (!foto) missingFields.push('Foto');

  if (missingFields.length > 0) {
    swal({
      title: "Campos faltantes",
      text: `Por favor, completa los siguientes campos: ${missingFields.join(', ')}`,
      icon: "warning",
      button: "Aceptar"
    });
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const newPoint = { title, description, lat: parseFloat(lat), lng: parseFloat(lng), categoria, foto: e.target.result };
    points.push(newPoint);
    addMarker(newPoint);
    updateTable();

    document.getElementById('formPunto').reset();
  };
  reader.readAsDataURL(foto);
});

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
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
        L.popup()
            .setLatLng([nearestPoint.lat, nearestPoint.lng])
            .setContent(popupContent)
            .openOn(map);
      }
    }, error => {
      console.error("Error getting user's location:", error);
    });
  } else {
    console.error("Geolocation is not supported by this browser.");
  }
}

document.getElementById('formEditPunto').addEventListener('submit', function(event) {
  event.preventDefault();
  const title = document.getElementById('editTitulo').value;
  const description = document.getElementById('editDescripcion').value;
  const lat = parseFloat(document.getElementById('editLat').value);
  const lng = parseFloat(document.getElementById('editLng').value);
  const categoria = document.getElementById('editCategoria').value;
  const fotoFile = document.getElementById('editFoto').files[0];

  if (fotoFile) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const updatedPoint = { title, description, lat, lng, categoria, foto: e.target.result };
      points[editIndex] = updatedPoint;
      editIndex = null;

      updateTable();
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          map.removeLayer(layer);
        }
      });
      points.forEach(addMarker);

      document.getElementById('editModal').setAttribute('hidden', '');

      swal({
        title: "Éxito",
        text: "¡Cambios guardados con éxito!",
        icon: "success",
        timer: 2000,
        buttons: false,
        position: "top-end"
      });
    };
    reader.readAsDataURL(fotoFile);
  } else {
    const updatedPoint = { title, description, lat, lng, categoria, foto: points[editIndex].foto };
    points[editIndex] = updatedPoint;
    editIndex = null;

    updateTable();
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
    points.forEach(addMarker);

    document.getElementById('editModal').setAttribute('hidden', '');

    swal({
      title: "Éxito",
      text: "¡Cambios guardados con éxito!",
      icon: "success",
      timer: 2000,
      buttons: false,
      position: "top-end"
    });
  }
});

document.addEventListener('DOMContentLoaded', function() {
  const categoriaSelect = document.getElementById('categoria');

  fetch('/javascripts/points.geojson')
      .then(response => response.json())
      .then(data => {
        points = data.features.map(feature => ({
          title: feature.properties.title,
          description: feature.properties.description,
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
          categoria: feature.properties.categoria,
          foto: feature.properties.foto
        }));
        points.forEach(addMarker);
        updateTable();

        const savedCategory = localStorage.getItem('selectedCategory');
        if (savedCategory) {
          categoriaSelect.value = savedCategory;
          filterPointsByCategory(savedCategory);
        }
      });

  categoriaSelect.addEventListener('change', function() {
    const selectedCategory = categoriaSelect.value;
    localStorage.setItem('selectedCategory', selectedCategory);
    filterPointsByCategory(selectedCategory);
  });

  function filterPointsByCategory(category) {
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    points.forEach(point => {
      if (point.categoria === category || category === "") {
        addMarker(point);
      }
    });
  }
});
