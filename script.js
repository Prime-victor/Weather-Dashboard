// script.js
const apiKey = '0527c9bd4d6bf351179261dd7c2e936d'; // Replace with your OpenWeatherMap API key
const cityInput = document.getElementById('cityInput');
const weatherInfo = document.getElementById('weatherInfo');
const unitToggle = document.getElementById('unitToggle');
const forecastContainer = document.getElementById('forecast');
const hourlyForecast = document.getElementById('hourlyForecast');
const aqiValue = document.getElementById('aqiValue');
const aqiStatus = document.getElementById('aqiStatus');
const aqiBarFill = document.getElementById('aqiBarFill');
const tempChartCanvas = document.getElementById('tempChart');
const historyList = document.getElementById('historyList');
const loader = document.getElementById('loader');
const app = document.getElementById('app');

let tempChart;
let map; // Leaflet map instance

function getWeather() {
  const city = cityInput.value;
  const units = unitToggle.value;
  if (!city) return;

  showLoader();
  fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${units}&appid=${apiKey}`)
    .then(res => res.json())
    .then(data => {
      const { lat, lon } = data.coord;
      updateCurrentWeather(data, units);
      saveToHistory(city);
      updateBackground(data.weather[0].main);
      initMap(lat, lon);

      getForecast(lat, lon, units);
      getAQI(lat, lon);
    })
    .catch(() => alert('City not found'))
    .finally(hideLoader);
}

function updateCurrentWeather(data, units) {
  document.getElementById('temp').textContent = `${Math.round(data.main.temp)}°`;
  document.getElementById('feelsLike').textContent = `Feels like ${Math.round(data.main.feels_like)}°`;
  document.getElementById('condition').textContent = data.weather[0].description;
  document.getElementById('weatherIcon').src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
  document.getElementById('wind').textContent = `${data.wind.speed} ${units === 'metric' ? 'm/s' : 'mph'}`;
  document.getElementById('humidity').textContent = `${data.main.humidity}%`;
}

function getForecast(lat, lon, units) {
  fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`)
    .then(res => res.json())
    .then(data => {
      renderHourlyForecast(data.list.slice(0, 6));
      renderFiveDayForecast(data.list);
      renderTemperatureTrend(data.list);
    });
}

function renderHourlyForecast(list) {
  hourlyForecast.innerHTML = '';
  list.forEach(item => {
    const hour = new Date(item.dt_txt).getHours();
    hourlyForecast.innerHTML += `
      <div class="hour-item">
        <span class="hour-time">${hour}:00</span>
        <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" alt="" class="hour-icon">
        <span class="hour-temp">${Math.round(item.main.temp)}°</span>
      </div>`;
  });
}

function renderFiveDayForecast(list) {
  const daily = {};
  list.forEach(item => {
    const day = item.dt_txt.split(' ')[0];
    if (!daily[day]) daily[day] = [];
    daily[day].push(item);
  });
  const days = Object.keys(daily).slice(0, 5);
  forecastContainer.innerHTML = '';
  days.forEach(day => {
    const temps = daily[day].map(i => i.main.temp);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const icon = daily[day][0].weather[0].icon;
    const date = new Date(day);
    forecastContainer.innerHTML += `
      <div class="day-card">
        <span class="day-name">${date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
        <img src="https://openweathermap.org/img/wn/${icon}.png" class="day-icon">
        <span class="day-temp">${Math.round(min)}° / ${Math.round(max)}°</span>
      </div>`;
  });
}

function renderTemperatureTrend(list) {
  const temps = list.slice(0, 8).map(i => i.main.temp);
  const labels = list.slice(0, 8).map(i => new Date(i.dt_txt).getHours() + ':00');
  if (tempChart) tempChart.destroy();
  tempChart = new Chart(tempChartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Temp',
        data: temps,
        fill: true,
        borderColor: '#007BFF',
        backgroundColor: 'rgba(0,123,255,0.2)',
        tension: 0.3
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

function getAQI(lat, lon) {
  fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`)
    .then(res => res.json())
    .then(data => {
      const aqi = data.list[0].main.aqi;
      aqiValue.textContent = aqi;
      aqiBarFill.style.width = `${aqi * 20}%`;

      aqiBarFill.className = 'aqi-bar-fill';
      if (aqi === 1) { aqiStatus.textContent = 'Good'; aqiBarFill.classList.add('aqi-good'); }
      else if (aqi === 2) { aqiStatus.textContent = 'Moderate'; aqiBarFill.classList.add('aqi-moderate'); }
      else if (aqi === 3) { aqiStatus.textContent = 'Unhealthy for Sensitive Groups'; aqiBarFill.classList.add('aqi-unhealthy'); }
      else if (aqi === 4) { aqiStatus.textContent = 'Unhealthy'; aqiBarFill.classList.add('aqi-very-unhealthy'); }
      else { aqiStatus.textContent = 'Hazardous'; aqiBarFill.classList.add('aqi-hazardous'); }
    });
}

// Initialize or update Leaflet map with OpenStreetMap base & OWM overlay
function initMap(lat, lon) {
  if (!map) {
    map = L.map('miniMap', { zoomControl: false }).setView([lat, lon], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    L.tileLayer(
      `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`,
      { opacity: 0.5 }
    ).addTo(map);
  } else {
    map.setView([lat, lon], 8);
  }
}

function updateBackground(condition) {
  app.classList.remove('sunny-bg', 'cloudy-bg', 'rainy-bg');
  const lower = condition.toLowerCase();
  if (lower.includes('cloud')) app.classList.add('cloudy-bg');
  else if (lower.includes('rain') || lower.includes('shower')) app.classList.add('rainy-bg');
  else app.classList.add('sunny-bg');
}

function saveToHistory(city) {
  let history = JSON.parse(localStorage.getItem('weatherHistory')) || [];
  if (!history.includes(city)) {
    history.unshift(city);
    localStorage.setItem('weatherHistory', JSON.stringify(history.slice(0, 6)));
    renderHistory();
  }
}

function renderHistory() {
  let history = JSON.parse(localStorage.getItem('weatherHistory')) || [];
  historyList.innerHTML = '';
  history.forEach(city => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = city;
    chip.onclick = () => { cityInput.value = city; getWeather(); };
    historyList.appendChild(chip);
  });
}

function clearHistory() {
  localStorage.removeItem('weatherHistory');
  renderHistory();
}

function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      cityInput.value = 'Current Location';
      updateBackground('sun');
      initMap(latitude, longitude);
      getForecast(latitude, longitude, unitToggle.value);
      getAQI(latitude, longitude);
    });
  }
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
}

function showLoader() { loader.classList.remove('hidden'); }
function hideLoader() { loader.classList.add('hidden'); }

// On load
renderHistory();
