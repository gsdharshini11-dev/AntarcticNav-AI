import express from 'express';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT) || 5001;

app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    status: 'online',
    system: 'AntarcticNav AI Core Engine',
    message: 'Server is running successfully'
  });
});

// System health endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    system: 'AntarcticNav AI Core Engine',
    timestamp: new Date().toISOString()
  });
});

// Weather API
app.get('/api/weather', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({
      status: 'UNAVAILABLE',
      message: 'Valid latitude and longitude required.'
    });
    return;
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code`;

    const apiRes = await fetch(url);

    if (!apiRes.ok) {
      throw new Error(`Open-Meteo error ${apiRes.status}`);
    }

    const data = await apiRes.json();

    res.json({
      status: 'LIVE',
      data
    });
  } catch (err) {
    console.error('Weather API error:', err);

    res.status(503).json({
      status: 'UNAVAILABLE',
      message: 'Live weather API unavailable.'
    });
  }
});

// Marine API
app.get('/api/ocean', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({
      status: 'UNAVAILABLE',
      message: 'Valid latitude and longitude required.'
    });
    return;
  }

  try {
    const url =
      `https://marine-api.open-meteo.com/v1/marine` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=wave_height,wave_direction,ocean_current_velocity`;

    const apiRes = await fetch(url);

    if (!apiRes.ok) {
      throw new Error(`Open-Meteo Marine error ${apiRes.status}`);
    }

    const data = await apiRes.json();

    res.json({
      status: 'LIVE',
      data
    });
  } catch (err) {
    console.error('Marine API error:', err);

    res.status(503).json({
      status: 'UNAVAILABLE',
      message: 'Live marine ocean API unavailable.'
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[AntarcticNav AI Server] Core API running on port ${PORT}`
  );
});
