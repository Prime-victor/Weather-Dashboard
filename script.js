const weatherInfo = document.getElementById("weatherInfo");
const cityInput = document.getElementById("cityInput");
const unitToggle = document.getElementById("unitToggle");
const historyList = document.getElementById("historyList");
const loader = document.getElementById("loader");

const apiKey = import.meta.env.VITE_API_KEY;

// Load search history on page load
window.onload = () => {
  updateClock();
  setInterval(updateClock, 1000);
  loadSearchHistory();
};

// Update real-time clock
function updateClock() {
  const now = new Date();
  document.getElementById("clock").textContent = now.toLocaleTimeString();
}

function getWeather(cityOverride = null) {
  const city = cityOverride || cityInput.value.trim();
  const units = unitToggle.value;

  if (!city) {
    alert("Please enter a city name.");
    return;
  }

  loader.classList.remove("hidden");
  weatherInfo.innerHTML = "";

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=${units}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      loader.classList.add("hidden");

      if (data.cod !== 200) {
        weatherInfo.innerHTML = `<p>City not found.</p>`;
        return;
      }

      const icon = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
      const tempUnit = units === "metric" ? "°C" : "°F";

      weatherInfo.innerHTML = `
        <h2>${data.name}, ${data.sys.country}</h2>
        <img src="${icon}" alt="${data.weather[0].description}"/>
        <p>${data.weather[0].main}</p>
        <p>Temp: ${data.main.temp} ${tempUnit}</p>
        <p>Humidity: ${data.main.humidity}%</p>
        <p>Wind: ${data.wind.speed} ${units === "metric" ? "m/s" : "mph"}</p>
      `;
      getForecast(data.coord.lat, data.coord.lon, units);
      getAQI(data.coord.lat, data.coord.lon);
      getUVIndex(data.coord.lat, data.coord.lon);

      // Change background based on weather condition
      changeBackground(data.weather[0].main);

      // Save to history
      saveToHistory(city);
    })
    .catch(err => {
      loader.classList.add("hidden");
      weatherInfo.innerHTML = `<p>Error fetching weather data.</p>`;
      console.error(err);
    });
}

function changeBackground(condition) {
  let image = "";

  switch (condition.toLowerCase()) {
    case "clear":
      image = "url('https://source.unsplash.com/1600x900/?sunny,sky')";
      break;
    case "clouds":
      image = "url('https://source.unsplash.com/1600x900/?cloudy,sky')";
      break;
    case "rain":
    case "drizzle":
      image = "url('https://source.unsplash.com/1600x900/?rain')";
      break;
    case "snow":
      image = "url('https://source.unsplash.com/1600x900/?snow')";
      break;
    case "thunderstorm":
      image = "url('https://source.unsplash.com/1600x900/?thunderstorm')";
      break;
    default:
      image = "url('https://source.unsplash.com/1600x900/?weather')";
  }

  document.body.style.backgroundImage = image;
}

function saveToHistory(city) {
  let history = JSON.parse(localStorage.getItem("weatherHistory")) || [];

  if (!history.includes(city)) {
    history.unshift(city);
    if (history.length > 5) history.pop(); // Limit to 5 entries
    localStorage.setItem("weatherHistory", JSON.stringify(history));
    loadSearchHistory();
  }
}

function loadSearchHistory() {
  const history = JSON.parse(localStorage.getItem("weatherHistory")) || [];
  historyList.innerHTML = "";

  history.forEach(city => {
    const li = document.createElement("li");
    li.textContent = city;
    li.onclick = () => getWeather(city);
    historyList.appendChild(li);
  });
}

function getForecast(lat, lon, units) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`;
  
  fetch(url)
    .then(res => res.json())
    .then(data => {
      const forecastContainer = document.getElementById("forecast");
      forecastContainer.innerHTML = "";

      const forecastMap = new Map();

      data.list.forEach(item => {
        const date = item.dt_txt.split(" ")[0];
        if (!forecastMap.has(date) && forecastMap.size < 5) {
          forecastMap.set(date, item);
        }
      });

      const labels = [];
      const temps = [];

      forecastMap.forEach(day => {
        const icon = `https://openweathermap.org/img/wn/${day.weather[0].icon}.png`;
        const tempUnit = units === "metric" ? "°C" : "°F";
        const date = new Date(day.dt_txt).toLocaleDateString(undefined, { weekday: 'short' });

        forecastContainer.innerHTML += `
          <div class="forecast-card">
            <p>${date}</p>
            <img src="${icon}" alt="${day.weather[0].description}" />
            <p>${Math.round(day.main.temp)} ${tempUnit}</p>
          </div>
        `;

        labels.push(date);
        temps.push(day.main.temp);
      });

      renderChart(labels, temps, units);
    });
}

function getAQI(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const aqi = data.list[0].main.aqi;
      const aqiText = ["Good", "Fair", "Moderate", "Poor", "Very Poor"];
      const colors = ["#00e400", "#a3c853", "#ffde33", "#ff9933", "#cc0033"];

      const aqiInfo = document.getElementById("aqiInfo");
      aqiInfo.innerHTML = `
        <p><strong>AQI:</strong> ${aqi} - ${aqiText[aqi - 1]}</p>
        <div style="background:${colors[aqi - 1]};height:10px;border-radius:4px;"></div>
      `;
    });
}

let chartInstance;

function renderChart(labels, temps, units) {
  const ctx = document.getElementById("tempChart").getContext("2d");

  if (chartInstance) {
    chartInstance.destroy(); // Re-render on update
  }

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: `Temperature (${units === "metric" ? "°C" : "°F"})`,
        data: temps,
        borderColor: "#00aaff",
        backgroundColor: "rgba(0,170,255,0.1)",
        borderWidth: 2,
        pointRadius: 5,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

function getUVIndex(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${apiKey}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const uvIndex = data.value;
      const uvInfo = document.getElementById("uvInfo");
      uvInfo.innerHTML = `<p><strong>UV Index:</strong> ${uvIndex}</p>`;
    });
}

function toggleUnits() {
  const units = unitToggle.value;
  const city = cityInput.value.trim();
  if (city) {
    getWeather(city);
  }
}
