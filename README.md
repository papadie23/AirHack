# AirFlow Nexus — AirHack 2025

**Smart Airport Operations Platform for Iași International Airport (LRIA/IAS)**  
*Awarded 2nd Place — Team Leader: [Your Name]*

---

<p align="center">
  <img src="screenshots/Passanger_Dashboard.png" alt="Passenger Dashboard" width="400" />
  <img src="screenshots/metar_employee_Dashboard.png" alt="Weather Briefing" width="400" />
  <img src="screenshots/fullscreen_map_inside_airport_guide.png" alt="Indoor Wayfinding Map" width="400" />
  <img src="screenshots/weather_Passanger_dashboard.png" alt="Passenger Weather" width="400" />
  <br>
  <img src="screenshots/phone_main_dashboard_with_map.png" alt="Mobile Map View" width="200" />
  <img src="screenshots/phone_menu_with_all_functionalities.png" alt="Mobile Menu" width="200" />
</p>

---

## What It Does

AirFlow Nexus is a unified airport intelligence platform that combines **real-time computer vision**, **AI-powered operations dispatch**, **live flight tracking**, **aviation weather briefing**, and **indoor passenger wayfinding** into a single dashboard. Built for Iași International Airport, it gives both **airport staff** and **passengers** a real-time view of terminal activity — from crowd density and bottleneck alerts to boarding progress and weather briefings.

### For Airport Operations (Staff)

| Feature | Description |
|---|---|
| **CV Dispatcher** | YOLOv8 + ByteTrack person counting across 3 terminal zones (Gate, Check-In, Disembarkation). Real-time MJPEG video feeds with detection overlays. |
| **AI Dispatcher (Gemini)** | Google Gemini LLM analyzes zone occupancy data and suggests operational actions — redirect staff, open additional lanes, manage queue overflow. Rule-based fallback when offline. |
| **Population Heatmap** | Orange CAMARA integration for device-based population density across the terminal. |
| **Live Announcements** | Admin can broadcast info/warning/danger messages to all passengers in real-time via Server-Sent Events (SSE). |
| **Aviation Weather** | Full METAR parsing with headwind/crosswind components for runways 08/26, density altitude, fog risk assessment, and cloud layer visualization. |

### For Passengers

| Feature | Description |
|---|---|
| **My Location** | GPS-calibrated indoor SVG map with ortho-routing, pinch-to-zoom, pan, and auto-follow. Guided boarding state machine (Check-In → Security → Documents → Gate → Boarding). |
| **My Flight** | Live flight status with departure gate, schedule, and progress tracking. |
| **Weather** | Departure and arrival airport weather from multiple providers (Open-Meteo, OpenWeatherMap, AccuWeather). |

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│  Video Feeds (3 zones)                                   │
│  Gate │ Check-In │ Disembarkation                        │
└──────────────┬──────────────────────────────────────────┘
               │ YOLOv8 + ByteTrack
               ▼
┌─────────────────────────────────────────────────────────┐
│  Person Counts → cv-output.json (every 3s)               │
│  MJPEG Streams → Flask Server (:5001)                    │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│  Astro SSR Dashboard (Vercel)                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐ │
│  │ Flights   │ │ Weather  │ │ AI Dispatcher (Gemini)    │ │
│  │ AirLabs   │ │ NOAA/OWM │ │ Congestion → Suggestions  │ │
│  └──────────┘ └──────────┘ └──────────────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐ │
│  │ Heatmap   │ │ SSE      │ │ Indoor Map + Wayfinding  │ │
│  │ CAMARA   │ │ Announce │ │ GPS → SVG Affine Calib   │ │
│  └──────────┘ └──────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Astro 6 (SSR), React 19, TypeScript 6 |
| **Styling** | Tailwind CSS 4, Custom CSS dark/light theme |
| **Charts** | Chart.js + react-chartjs-2 |
| **AI/LLM** | Google Gemini SDK (1.5 Flash) |
| **Computer Vision** | YOLOv8 + ByteTrack (ultralytics), Flask MJPEG |
| **Maps** | Google Maps JS API, custom SVG calibration |
| **External APIs** | AirLabs (flights), NOAA (METAR), Open-Meteo, Orange CAMARA (device location/density) |
| **Deployment** | Vercel (Astro SSR adapter) |

---

## Running Locally

```bash
# Install dependencies
npm install

# Set up environment (optional — runs with fixtures by default)
cp .env.example .env
# Set USE_FIXTURES=true for demo mode

# Start the dashboard
npm run dev
# Opens at http://localhost:4321

# (Optional) Start the computer vision pipeline
cd video_analytics
pip install ultralytics flask
python stream_server.py &   # MJPEG streams on :5001
python process_streams.py &  # Person counts → cv-output.json
```

---

## Demo Mode

The entire platform runs without any API keys using bundled fixture data and rule-based AI fallbacks. Set `USE_FIXTURES=true` in `.env` for a fully functional offline demo.

---

## About AirHack

AirHack was a hackathon organized for Iași International Airport challenging teams to build solutions for smarter airport operations. This project won **2nd place**, developed under my leadership as team lead.

---

## Screenshots

### Passenger Dashboard
![Passenger Dashboard](screenshots/Passanger_Dashboard.png)

### Employee Dashboard — METAR Weather Briefing
![Weather Briefing](screenshots/metar_employee_Dashboard.png)

### Indoor Passenger Wayfinding Map
![Indoor Map](screenshots/fullscreen_map_inside_airport_guide.png)

### Passenger Weather View
![Passenger Weather](screenshots/weather_Passanger_dashboard.png)

### Mobile — Map View
<img src="screenshots/phone_main_dashboard_with_map.png" alt="Mobile Map" width="300" />

### Mobile — Menu
<img src="screenshots/phone_menu_with_all_functionalities.png" alt="Mobile Menu" width="300" />

---

## License

MIT
