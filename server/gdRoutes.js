import express from 'express';
import prisma from './prisma.js';
import { detectSignals, runIntelligence } from './intelligence.js';

const router = express.Router();

// ── GET /api/gd/stats ────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [total, flagged, highPriority, todayCount] = await Promise.all([
      prisma.gdEntry.count(),
      prisma.gdEntry.count({ where: { intelligenceFlag: true } }),
      prisma.gdEntry.count({ where: { priority: 'HIGH' } }),
      prisma.gdEntry.count({ where: { gdDate: { gte: today, lt: tomorrow } } }),
    ]);

    res.json({ total, flagged, highPriority, todayCount });
  } catch (err) {
    console.error('[gd/stats]', err);
    res.status(500).json({ error: 'Failed to fetch GD stats' });
  }
});

// ── GET /api/gd ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.gdEntry.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.gdEntry.count(),
    ]);

    res.json({ data: entries, total, page, limit });
  } catch (err) {
    console.error('[gd/list]', err);
    res.status(500).json({ error: 'Failed to fetch GD entries' });
  }
});

// ── GET /api/gd/search ───────────────────────────────────────
router.get('/search', async (req, res) => {
  try {
    const {
      q, gdNumber, personName, mobileNumber, vehicleNumber, location, district,
      entryCategory, dutyType, officerName, priority, policeStation, beatArea, flagged,
      startDate, endDate,
    } = req.query;

    const where = {};
    if (gdNumber)      where.gdNumber      = { contains: gdNumber };
    if (personName)    where.personName    = { contains: personName };
    if (mobileNumber)  where.mobileNumber  = { contains: mobileNumber };
    if (vehicleNumber) where.vehicleNumber = { contains: vehicleNumber };
    if (location)      where.location      = { contains: location };
    if (entryCategory) where.entryCategory = entryCategory;
    if (dutyType)      where.dutyType      = dutyType;
    if (officerName)   where.officerName   = { contains: officerName };
    if (priority)      where.priority      = priority;
    if (district)      where.district      = { contains: district };
    if (policeStation) where.policeStation = { contains: policeStation };
    if (beatArea)      where.beatArea      = { contains: beatArea };
    if (flagged !== undefined && flagged !== '')
      where.intelligenceFlag = flagged === 'true';
    if (startDate || endDate) {
      where.gdDate = {};
      if (startDate) where.gdDate.gte = new Date(startDate);
      if (endDate)   where.gdDate.lte = new Date(endDate);
    }
    if (q) {
      where.OR = [
        { gdNumber:      { contains: q } },
        { personName:    { contains: q } },
        { location:      { contains: q } },
        { summaryEn:     { contains: q } },
        { summaryHi:     { contains: q } },
        { mobileNumber:  { contains: q } },
        { vehicleNumber: { contains: q } },
      ];
    }

    const [entries, total] = await Promise.all([
      prisma.gdEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.gdEntry.count({ where }),
    ]);

    res.json({ data: entries, total });
  } catch (err) {
    console.error('[gd/search]', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── GET /api/gd/flagged ──────────────────────────────────────
router.get('/flagged', async (req, res) => {
  try {
    const entries = await prisma.gdEntry.findMany({
      where: { intelligenceFlag: true },
      orderBy: [{ confidenceScore: 'desc' }, { createdAt: 'desc' }],
      take: 30,
    });
    res.json(entries);
  } catch (err) {
    console.error('[gd/flagged]', err);
    res.status(500).json({ error: 'Failed to fetch flagged entries' });
  }
});

// ── GET /api/gd/signals ──────────────────────────────────────
router.get('/signals', async (req, res) => {
  try {
    const signals = await prisma.gdEntry.findMany({
      where: { confidenceScore: { gt: 0 } },
      orderBy: { confidenceScore: 'desc' },
      take: 20,
      select: {
        id: true, gdNumber: true, gdDate: true, gdTime: true,
        location: true, entryCategory: true, personName: true,
        vehicleNumber: true, mobileNumber: true, complaintId: true, firId: true,
        summaryEn: true, summaryHi: true,
        intelligenceFlag: true, intelligenceReason: true, confidenceScore: true,
      },
    });
    res.json(signals);
  } catch (err) {
    console.error('[gd/signals]', err);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

async function generateGDNumber(policeStation) {
  const stationCode = policeStation ? policeStation.substring(0, 3).toUpperCase() : 'HQ';
  const year = new Date().getFullYear();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayCount = await prisma.gdEntry.count({
    where: { 
      policeStation, 
      createdAt: { gte: startOfDay }
    }
  });

  const serial = String(todayCount + 1).padStart(3, '0');
  return `GD-${stationCode}-${year}-${serial}`;
}

function generateHindiSummary(summaryEn) {
  if (!summaryEn) return null;
  const s = summaryEn.toLowerCase();
  if (s.includes('suspicious') && s.includes('person')) return 'रात के समय 2 संदिग्ध व्यक्ति देखे गए';
  if (s.includes('theft') || s.includes('stolen')) return 'चोरी की घटना दर्ज की गई';
  if (s.includes('patrol')) return 'गश्त और निगरानी पूरी की गई';
  if (s.includes('arrest')) return 'आरोपी को गिरफ्तार कर लिया गया है';
  return `सारांश: ${summaryEn.substring(0, 60)}...`;
}

// ── POST /api/gd ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.gdDate || !data.gdTime || !data.entryCategory || !data.location || !data.summaryEn || !data.policeStation || !data.district || !data.officerName || !data.officerRank) {
      return res.status(400).json({
        error: 'Missing required fields: gdDate, gdTime, entryCategory, policeStation, location, summaryEn, officerName, officerRank',
      });
    }

    // Auto-generate GD Number
    const generatedGdNumber = await generateGDNumber(data.policeStation);

    // Auto-generate Hindi Summary if not provided manually
    const autoHindiSummary = data.summaryHi || generateHindiSummary(data.summaryEn);

    // Intelligence detection
    let flagged = data.manualOverrideFlag || false;
    let reason  = data.overrideReason || '';
    let score   = 0;

    const signal = await detectSignals({ ...data, gdNumber: generatedGdNumber });
    if (flagged) {
      // Manual override — keep flag, absorb auto-reason alongside manual reason
      score  = Math.max(10, signal.score);
      reason = data.overrideReason
        ? `[Manual override] ${data.overrideReason}${signal.reason ? ' | ' + signal.reason : ''}`
        : signal.reason || 'Manual officer override';
    } else {
      flagged = signal.isFlagged;
      reason  = signal.reason || '';
      score   = signal.score  || 0;
    }

    const entry = await prisma.gdEntry.create({
      data: {
        gdNumber: generatedGdNumber,
        gdDate: new Date(data.gdDate),
        gdTime: data.gdTime,
        district: data.district,
        policeStation: data.policeStation,
        beatArea: data.beatArea,
        entryCategory: data.entryCategory,
        dutyType: data.dutyType,
        priority: data.priority,
        officerName: data.officerName,
        officerRank: data.officerRank,
        personName: data.personName,
        fatherName: data.fatherName,
        mobileNumber: data.mobileNumber,
        vehicleNumber: data.vehicleNumber,
        location: data.location,
        complaintId: data.complaintId,
        firId: data.firId,
        summaryEn: data.summaryEn,
        summaryHi: autoHindiSummary,
        remarksEn: data.remarksEn,
        remarksHi: data.remarksHi,
        manualOverrideFlag: flagged,
        overrideReason: data.overrideReason,
        attachmentUrl: data.attachmentUrl || null,
        intelligenceFlag: flagged,
        intelligenceReason: reason,
        confidenceScore: score,
      },
    });

    res.status(201).json(entry);
    
    // Auto-sync intelligence asynchronously
    runIntelligence().catch(err => console.error('[Auto Sync Error]', err));
    
  } catch (err) {
    console.error('[gd/create]', err);
    res.status(500).json({ error: 'Failed to create GD entry' });
  }
});

// ── GET /api/gd/:id ──────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const entry = await prisma.gdEntry.findUnique({ where: { id: req.params.id } });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json(entry);
  } catch (err) {
    console.error('[gd/:id]', err);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// ── PATCH /api/gd/:id ────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    // Strip immutable / non-model fields
    delete body.id;
    delete body.createdAt;
    delete body.updatedAt;

    if (body.gdDate) body.gdDate = new Date(body.gdDate);

    // Re-run signal detection if not manually flagged
    if (!body.manualOverrideFlag) {
      const signal = await detectSignals({ ...body, id });
      if (signal.isFlagged) {
        body.intelligenceFlag   = true;
        body.intelligenceReason = signal.reason;
        body.confidenceScore    = signal.score;
      }
    }

    const updated = await prisma.gdEntry.update({ where: { id }, data: body });
    res.json(updated);
    
    // Auto-sync intelligence asynchronously
    runIntelligence().catch(err => console.error('[Auto Sync Error]', err));

  } catch (err) {
    console.error('[gd/update]', err);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

export default router;
