// API Configuration
const API_KEY = '0527c9bd4d6bf351179261dd7c2e936d';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// DOM Elements
const elements = {
  cityInput: document.getElementById('cityInput'),
  searchBtn: document.getElementById('searchBtn'),
  locationBtn: document.getElementById('locationBtn'),
  unitToggle: document.getElementById('unitToggle'),
  themeToggle: document.getElementById('themeToggle'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  currentTime: document.getElementById('currentTime'),
  currentDate: document.getElementById('currentDate'),
  weatherIcon: document.getElementById('weatherIcon'),
  currentTemp: document.getElementById('currentTemp'),
  weatherCondition: document.getElementById('weatherCondition'),
  feelsLike: document.getElementById('feelsLike'),
  windSpeed: document.getElementById('windSpeed'),
  humidity: document.getElementById('humidity'),
  uvIndex: document.getElementById('uvIndex'),
  hourlyForecast: document.getElementById('hourlyForecast'),
  dailyForecast: document.getElementById('dailyForecast'),
  aqiDisplay: document.getElementById('aqiDisplay'),
  aqiDescription: document.getElementById('aqiDescription'),
  pollutantsContainer: document.getElementById('pollutantsContainer'),
  historyList: document.getElementById('historyList'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  loadingText: document.getElementById('loadingText'),
  progressBar: document.getElementById('progressBar'),
  errorToast: document.getElementById('errorToast'),
  errorMessage: document.getElementById('errorMessage'),
  tempChart: document.getElementById('tempChart'),
  weatherMap: document.getElementById('weatherMap')
};

// Global Variables
let weatherMap;
let tempChartInstance;
let currentWeatherData;
let currentUnit = 'metric';
const searchHistory = JSON.parse(localStorage.getItem('weatherHistory')) || [];

// Initialize the application
function init() {
  // Set up event listeners
  setupEventListeners();
  
  // Check for saved theme preference
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);
  
  // Load last searched city or current location
  loadInitialWeather();
  
  // Update time display
  updateDateTime();
  setInterval(updateDateTime, 1000);
}

// Set up all event listeners
function setupEventListeners() {
  elements.searchBtn.addEventListener('click', handleSearch);
  elements.cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  
  elements.locationBtn.addEventListener('click', getCurrentLocationWeather);
  elements.unitToggle.addEventListener('change', handleUnitChange);
  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.clearHistoryBtn.addEventListener('click', clearHistory);
  
  // Map control buttons
  document.querySelectorAll('.map-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMapLayer(btn.dataset.layer));
  });
}

// Load initial weather data
async function loadInitialWeather() {
  if (searchHistory.length > 0) {
    elements.cityInput.value = searchHistory[0];
    await fetchWeatherData(searchHistory[0]);
  } else {
    getCurrentLocationWeather();
  }
}

// Handle city search
async function handleSearch() {
  const city = elements.cityInput.value.trim();
  if (!city) {
    showError('Please enter a city name');
    return;
  }
  
  await fetchWeatherData(city);
}

// Fetch all weather data for a city
async function fetchWeatherData(city) {
  try {
    showLoading(`Fetching weather data for ${city}...`);
    
    // Reset progress
    updateProgress(0);
    
    // Fetch current weather
    const weatherData = await fetchData(`${BASE_URL}/weather?q=${city}&units=${currentUnit}&appid=${API_KEY}`);
    updateProgress(30);
    
    if (!weatherData || !weatherData.coord) {
      throw new Error('City not found');
    }
    
    const { lat, lon } = weatherData.coord;
    
    // Fetch forecast and AQI in parallel
    const [forecastData, aqiData] = await Promise.all([
      fetchData(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${API_KEY}`),
      fetchData(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
    ]);
    
    updateProgress(80);
    
    // Update UI with all data
    updateCurrentWeather(weatherData);
    updateForecast(forecastData);
    updateAirQuality(aqiData);
    initMap(lat, lon);
    
    // Add to search history
    addToHistory(city);
    
    updateProgress(100);
    hideLoading();
  } catch (error) {
    console.error('Error fetching weather data:', error);
    showError(error.message || 'Failed to fetch weather data');
    hideLoading();
  }
}

// Fetch data from API with error handling
async function fetchData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error('Network error. Please check your connection.');
  }
}

// Update current weather display
function updateCurrentWeather(data) {
  currentWeatherData = data;
  
  // Main weather info
  elements.currentTemp.textContent = `${Math.round(data.main.temp)}°`;
  elements.weatherCondition.textContent = data.weather[0].description;
  elements.weatherIcon.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;
  elements.weatherIcon.alt = data.weather[0].description;
  
  // Weather details
  elements.feelsLike.textContent = `${Math.round(data.main.feels_like)}°`;
  elements.windSpeed.textContent = `${data.wind.speed} ${currentUnit === 'metric' ? 'm/s' : 'mph'}`;
  elements.humidity.textContent = `${data.main.humidity}%`;
  
  // Update UV index (not available in basic API, using placeholder)
  elements.uvIndex.textContent = '--';
  
  // Update background based on weather condition
  updateBackground(data.weather[0].main, data.sys.sunrise, data.sys.sunset);
}

// Update forecast displays
function updateForecast(data) {
  if (!data || !data.list) return;
  
  // Update hourly forecast
  updateHourlyForecast(data.list.slice(0, 8));
  
  // Update daily forecast
  updateDailyForecast(data.list);
  
  // Update temperature chart
  updateTemperatureChart(data.list);
}

// Update hourly forecast
function updateHourlyForecast(hourlyData) {
  elements.hourlyForecast.innerHTML = '';
  
  hourlyData.forEach(item => {
    const time = new Date(item.dt * 1000).getHours();
    const hourItem = document.createElement('div');
    hourItem.className = 'hourly-item';
    hourItem.innerHTML = `
      <span class="hourly-time">${time}:00</span>
      <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" 
           alt="${item.weather[0].description}" class="hourly-icon">
      <span class="hourly-temp">${Math.round(item.main.temp)}°</span>
    `;
    elements.hourlyForecast.appendChild(hourItem);
  });
}

// Update daily forecast
function updateDailyForecast(forecastData) {
  // Group forecast by day
  const dailyForecast = {};
  
  forecastData.forEach(item => {
    const date = new Date(item.dt * 1000).toLocaleDateString(undefined, { weekday: 'short' });
    if (!dailyForecast[date]) {
      dailyForecast[date] = {
        temps: [],
        weather: []
      };
    }
    dailyForecast[date].temps.push(item.main.temp);
    dailyForecast[date].weather.push(item.weather[0]);
  });
  
  // Display next 5 days
  elements.dailyForecast.innerHTML = '';
  const days = Object.keys(dailyForecast).slice(0, 5);
  
  days.forEach(day => {
    const dayData = dailyForecast[day];
    const minTemp = Math.min(...dayData.temps);
    const maxTemp = Math.max(...dayData.temps);
    const mostCommonWeather = getMostCommonWeather(dayData.weather);
    
    const dayItem = document.createElement('div');
    dayItem.className = 'daily-item';
    dayItem.innerHTML = `
      <span class="daily-day">${day}</span>
      <img src="https://openweathermap.org/img/wn/${mostCommonWeather.icon}.png" 
           alt="${mostCommonWeather.description}" class="daily-icon">
      <div class="daily-temps">
        <span class="daily-high">${Math.round(maxTemp)}°</span>
        <span class="daily-low">${Math.round(minTemp)}°</span>
      </div>
    `;
    elements.dailyForecast.appendChild(dayItem);
  });
}

// Get most common weather condition for the day
function getMostCommonWeather(weatherArray) {
  const counts = {};
  let maxCount = 0;
  let mostCommon;
  
  weatherArray.forEach(weather => {
    const key = weather.icon;
    counts[key] = (counts[key] || 0) + 1;
    if (counts[key] > maxCount) {
      maxCount = counts[key];
      mostCommon = weather;
    }
  });
  
  return mostCommon;
}

// Update temperature chart
function updateTemperatureChart(forecastData) {
  const hourlyData = forecastData.slice(0, 8);
  const labels = hourlyData.map(item => 
    new Date(item.dt * 1000).getHours() + ':00'
  );
  const temps = hourlyData.map(item => item.main.temp);
  
  // Destroy previous chart if exists
  if (tempChartInstance) {
    tempChartInstance.destroy();
  }
  
  // Create new chart
  const ctx = elements.tempChart.getContext('2d');
  tempChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Temperature',
        data: temps,
        borderColor: '#4361ee',
        backgroundColor: 'rgba(67, 97, 238, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointBackgroundColor: '#4361ee',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y}°${currentUnit === 'metric' ? 'C' : 'F'}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: (value) => `${value}°`
          }
        }
      }
    }
  });
}

// Update air quality display
function updateAirQuality(data) {
  if (!data || !data.list || data.list.length === 0) return;
  
  const aqi = data.list[0].main.aqi;
  const pollutants = data.list[0].components;
  
  // Update AQI display
  elements.aqiDisplay.textContent = aqi;
  elements.aqiDisplay.className = `aqi-value aqi-${getAQIClass(aqi)}`;
  
  // Update AQI description
  elements.aqiDescription.textContent = getAQIDescription(aqi);
  
  // Update pollutants
  elements.pollutantsContainer.innerHTML = '';
  for (const [key, value] of Object.entries(pollutants)) {
    const pollutantItem = document.createElement('div');
    pollutantItem.className = 'pollutant-item';
    pollutantItem.innerHTML = `
      <span class="pollutant-value">${value.toFixed(1)}</span>
      <span class="pollutant-label">${getPollutantName(key)}</span>
    `;
    elements.pollutantsContainer.appendChild(pollutantItem);
  }
}

// Get AQI class based on value
function getAQIClass(aqi) {
  switch (aqi) {
    case 1: return 'good';
    case 2: return 'moderate';
    case 3: return 'unhealthy';
    case 4: return 'very-unhealthy';
    case 5: return 'hazardous';
    default: return 'unknown';
  }
}

// Get AQI description
function getAQIDescription(aqi) {
  const descriptions = {
    1: 'Air quality is satisfactory, and air pollution poses little or no risk.',
    2: 'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.',
    3: 'Members of sensitive groups may experience health effects. The general public is less likely to be affected.',
    4: 'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.',
    5: 'Health warning of emergency conditions: everyone is more likely to be affected.'
  };
  return descriptions[aqi] || 'Air quality data not available.';
}

// Get pollutant name
function getPollutantName(key) {
  const names = {
    co: 'CO',
    no: 'NO',
    no2: 'NO₂',
    o3: 'O₃',
    so2: 'SO₂',
    pm2_5: 'PM2.5',
    pm10: 'PM10',
    nh3: 'NH₃'
  };
  return names[key] || key;
}

// Initialize or update map
function initMap(lat, lon) {
  if (!weatherMap) {
    // Initialize map
    weatherMap = L.map(elements.weatherMap).setView([lat, lon], 8);
    
    // Add base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(weatherMap);
    
    // Add initial weather layer
    addWeatherLayer('precipitation_new');
  } else {
    // Update map view
    weatherMap.setView([lat, lon], 8);
  }
}

// Add weather layer to map
function addWeatherLayer(layerType) {
  // Remove existing weather layer if any
  if (weatherMap.weatherLayer) {
    weatherMap.removeLayer(weatherMap.weatherLayer);
  }
  
  // Add new weather layer
  weatherMap.weatherLayer = L.tileLayer(
    `https://tile.openweathermap.org/map/${layerType}/{z}/{x}/{y}.png?appid=${API_KEY}`,
    { opacity: 0.7 }
  ).addTo(weatherMap);
  
  // Update active button
  document.querySelectorAll('.map-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layer === layerType);
  });
}

// Switch map layer
function switchMapLayer(layerType) {
  addWeatherLayer(layerType);
}

// Update background based on weather and time
function updateBackground(weatherCondition, sunrise, sunset) {
  // Remove all weather background classes
  document.body.className = '';
  
  // Determine if it's day or night
  const now = Date.now() / 1000;
  const isDaytime = now > sunrise && now < sunset;
  
  // Add appropriate background class
  const condition = weatherCondition.toLowerCase();
  let bgClass = 'weather-bg-';
  
  if (condition.includes('clear')) {
    bgClass += isDaytime ? 'clear' : 'night';
  } else if (condition.includes('cloud')) {
    bgClass += 'clouds';
  } else if (condition.includes('rain')) {
    bgClass += 'rain';
  } else if (condition.includes('thunderstorm')) {
    bgClass += 'thunderstorm';
  } else if (condition.includes('snow')) {
    bgClass += 'snow';
  } else if (condition.includes('mist') || condition.includes('fog')) {
    bgClass += 'mist';
  } else {
    bgClass += isDaytime ? 'clear' : 'night';
  }
  
  document.body.classList.add(bgClass);
}

// Handle unit change
function handleUnitChange() {
  currentUnit = elements.unitToggle.value;
  if (currentWeatherData) {
    fetchWeatherData(currentWeatherData.name);
  }
}

// Get weather for current location
function getCurrentLocationWeather() {
  showLoading('Getting your location...');
  
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          updateProgress(30);
          
          // Get city name from coordinates
          const geoData = await fetchData(
            `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${API_KEY}`
          );
          
          if (geoData && geoData.length > 0) {
            elements.cityInput.value = geoData[0].name;
            await fetchWeatherData(geoData[0].name);
          } else {
            // If no city name, use coordinates directly
            elements.cityInput.value = 'Your Location';
            await fetchWeatherByCoords(latitude, longitude);
          }
        } catch (error) {
          showError('Failed to get location data');
          hideLoading();
        }
      },
      (error) => {
        showError('Location access denied. Please enable location services.');
        hideLoading();
      }
    );
  } else {
    showError('Geolocation is not supported by your browser');
    hideLoading();
  }
}

// Fetch weather by coordinates
async function fetchWeatherByCoords(lat, lon) {
  try {
    updateProgress(50);
    
    const [weatherData, forecastData, aqiData] = await Promise.all([
      fetchData(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${API_KEY}`),
      fetchData(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${API_KEY}`),
      fetchData(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
    ]);
    
    updateProgress(80);
    
    updateCurrentWeather(weatherData);
    updateForecast(forecastData);
    updateAirQuality(aqiData);
    initMap(lat, lon);
    
    updateProgress(100);
    hideLoading();
  } catch (error) {
    showError('Failed to fetch weather data');
    hideLoading();
  }
}

// Update date and time display
function updateDateTime() {
  const now = new Date();
  elements.currentTime.textContent = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  elements.currentDate.textContent = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Add city to search history
function addToHistory(city) {
  // Remove duplicate if exists
  const index = searchHistory.indexOf(city);
  if (index !== -1) {
    searchHistory.splice(index, 1);
  }
  
  // Add to beginning of array
  searchHistory.unshift(city);
  
  // Keep only last 5 searches
  if (searchHistory.length > 5) {
    searchHistory.pop();
  }
  
  // Save to localStorage
  localStorage.setItem('weatherHistory', JSON.stringify(searchHistory));
  
  // Update history display
  updateHistoryDisplay();
}

// Update history display
function updateHistoryDisplay() {
  elements.historyList.innerHTML = '';
  
  searchHistory.forEach(city => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.textContent = city;
    historyItem.addEventListener('click', () => {
      elements.cityInput.value = city;
      handleSearch();
    });
    elements.historyList.appendChild(historyItem);
  });
}

// Clear search history
function clearHistory() {
  searchHistory.length = 0;
  localStorage.removeItem('weatherHistory');
  updateHistoryDisplay();
}

// Toggle theme between light and dark
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

// Set theme
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // Update theme toggle icon
  const icon = elements.themeToggle.querySelector('i');
  icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Show loading overlay
function showLoading(message) {
  elements.loadingText.textContent = message;
  elements.loadingOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// Hide loading overlay
function hideLoading() {
  elements.loadingOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

// Update progress bar
function updateProgress(percent) {
  elements.progressBar.style.width = `${percent}%`;
}

// Show error message
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorToast.classList.add('show');
  
  // Hide after 5 seconds
  setTimeout(() => {
    elements.errorToast.classList.remove('show');
  }, 5000);
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
// Add touch support for hourly forecast scrolling
let touchStartX = 0;
let touchEndX = 0;

elements.hourlyForecast.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
}, {passive: true});

elements.hourlyForecast.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  if (touchEndX < touchStartX - 50) {
    elements.hourlyForecast.scrollBy(100, 0);
  } else if (touchEndX > touchStartX + 50) {
    elements.hourlyForecast.scrollBy(-100, 0);
  }
}, {passive: true});