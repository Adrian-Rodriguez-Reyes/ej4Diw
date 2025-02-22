// Initialize the map
var map = L.map('map').setView([0, 0], 2);

// Add OpenStreetMap layer
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

// Add the custom control to the map
L.control.nearestPoint({ position: 'topright' }).addTo(map);

// Array to store points of interest
let points = [];
let editIndex = null;

// Clear user-created points from LocalStorage on page load
localStorage.removeItem('userPoints');

// Load points of interest from JSON
fetch('/javascripts/points.json')
    .then(response => response.json())
    .then(data => {
      points = data;
      points.forEach(addMarker);
      updateTable();
    });


// Function to add a marker to the map
// Function to add a marker to the map
function addMarker(point) {
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
  L.marker([point.lat, point.lng]).addTo(map)
      .bindPopup(popupContent);
}

// Function to show the image modal
function showImageModal(src, title) {
  document.getElementById('modalImage').src = src;
  document.getElementById('imageModalLabel').innerText = title;
  var imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
  imageModal.show();
}
// Function to update the table of points of interest
function updateTable() {
  const tbody = document.querySelector('#tablaPuntos tbody');
  tbody.innerHTML = '';
  points.forEach((point, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${point.title}</td>
      <td>${point.lat}</td>
      <td>${point.lng}</td>
      <td>${point.categoria}</td>
      <td>
        <button class="btn btn-warning btn-sm" onclick="showEditModal(${index})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeletePoint(${index}, true)">Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Function to confirm deletion of a point of interest
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

// Function to delete a point of interest
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

// Function to show the edit modal and populate the form
function showEditModal(index) {
  const point = points[index];
  document.getElementById('editTitulo').value = point.title;
  document.getElementById('editDescripcion').value = point.description;
  document.getElementById('editLat').value = point.lat;
  document.getElementById('editLng').value = point.lng;
  document.getElementById('editCategoria').value = point.categoria;
  editIndex = index;

  // Quitar el atributo 'hidden' para mostrar el modal
  document.getElementById('editModal').removeAttribute('hidden');
}

// Agrega un listener al botón de cerrar el modal
document.getElementById('closeModal').addEventListener('click', function () {
  document.getElementById('editModal').setAttribute('hidden', '');
});

// Handle form submission to add a new point of interest
document.getElementById('formPunto').addEventListener('submit', function(event) {
  event.preventDefault();
  const title = document.getElementById('titulo').value;
  const description = document.getElementById('descripcion').value;
  const lat = parseFloat(document.getElementById('lat').value);
  const lng = parseFloat(document.getElementById('lng').value);
  const categoria = document.getElementById('categoria').value;
  const foto = document.getElementById('foto').files[0];

  const reader = new FileReader();
  reader.onload = function(e) {
    const newPoint = { title, description, lat, lng, categoria, foto: e.target.result };
    points.push(newPoint);
    addMarker(newPoint);
    updateTable();

    // Clear the form
    document.getElementById('formPunto').reset();
  };
  reader.readAsDataURL(foto);
});

// Function to calculate the distance between two points using the Haversine formula
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

// Function to find the nearest point of interest to the user's location
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
// Function to get the user's current position and show the nearest point of interest
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

// Handle form submission to edit a point of interest
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

      // Hide the modal
      document.getElementById('editModal').setAttribute('hidden', '');

      // Show success alert
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

    // Hide the modal
    document.getElementById('editModal').setAttribute('hidden', '');

    // Show success alert
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

  // Filter points based on selected category
  categoriaSelect.addEventListener('change', function() {
    const selectedCategory = categoriaSelect.value;
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
