import express from 'express';
import prisma from './prisma.js';

const router = express.Router();

// GET summary
router.get('/dashboard-summary', async (req, res) => {
  try {
    const totalHotspots = await prisma.preventiveHotspot.count();
    const highRiskAreas = await prisma.preventiveHotspot.count({ where: { riskScore: { gte: 70 } } });
    const pendingActions = await prisma.preventiveSuggestion.count({ where: { actionStatus: 'PENDING' } });
    const weeklySignals = await prisma.preventivePattern.count(); // Mock proxy for weekly signals

    res.json({ totalHotspots, highRiskAreas, pendingActions, weeklySignals });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// GET hotspots
router.get('/hotspots', async (req, res) => {
  try {
    const hotspots = await prisma.preventiveHotspot.findMany({
      orderBy: { riskScore: 'desc' }
    });
    res.json(hotspots);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch hotspots' });
  }
});

// GET patterns
router.get('/patterns', async (req, res) => {
  try {
    const patterns = await prisma.preventivePattern.findMany({
      orderBy: { confidence: 'desc' }
    });
    res.json(patterns);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch patterns' });
  }
});

// GET suggestions
router.get('/suggestions', async (req, res) => {
  try {
    const suggestions = await prisma.preventiveSuggestion.findMany({
      orderBy: { id: 'desc' }
    });
    res.json(suggestions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// Mock generation endpoints
router.post('/hotspots/generate', async (req, res) => {
  try {
    // Generate a dummy hotspot
    const h = await prisma.preventiveHotspot.create({
      data: {
        areaName: 'Sector ' + Math.floor(Math.random() * 50) + ' Market',
        policeStationId: 1,
        sourceType: 'Mixed',
        sourceCount: Math.floor(Math.random() * 20),
        riskScore: Math.floor(Math.random() * 100),
        hotspotType: 'Theft Prone',
        status: 'Active'
      }
    });
    res.json(h);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate hotspot' });
  }
});

export default router;
