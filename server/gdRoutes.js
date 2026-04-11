import express from 'express';
import prisma from './prisma.js';

const router = express.Router();

// GET all GD entries
router.get('/', async (req, res) => {
  try {
    const entries = await prisma.smartGDEntry.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(entries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch GD entries' });
  }
});

// GET flagged GD entries
router.get('/flagged', async (req, res) => {
  try {
    const entries = await prisma.smartGDEntry.findMany({
      where: { preventiveFlag: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(entries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch flagged entries' });
  }
});

// POST a new GD entry
router.post('/', async (req, res) => {
  try {
    const { 
      gdNumber, gdDate, gdTime, policeStationId, beatId, entryType, priority,
      personName, fatherName, mobileNo, vehicleNo, placeText, latitude, longitude,
      summary, remarks, linkedComplaintId, linkedFirId, attachmentUrl 
    } = req.body;

    // VERY BASIC Intelligence Layer Check
    const pastEntries = await prisma.smartGDEntry.findMany({
      where: {
        OR: [
          { placeText: placeText },
          { mobileNo: mobileNo && mobileNo !== '' ? mobileNo : undefined },
          { vehicleNo: vehicleNo && vehicleNo !== '' ? vehicleNo : undefined }
        ]
      }
    });

    let isFlagged = false;
    let reason = '';

    if (pastEntries.length > 0) {
      isFlagged = true;
      reason = 'Repeated activity found (Place/Mobile/Vehicle)';
    }

    const newEntry = await prisma.smartGDEntry.create({
      data: {
        gdNumber, 
        gdDate: new Date(gdDate), 
        gdTime, 
        policeStationId: parseInt(policeStationId || 1), 
        beatId: beatId ? parseInt(beatId) : null, 
        entryType, 
        priority,
        personName, 
        fatherName, 
        mobileNo, 
        vehicleNo, 
        placeText, 
        latitude: latitude ? parseFloat(latitude) : null, 
        longitude: longitude ? parseFloat(longitude) : null,
        summary, 
        remarks, 
        linkedComplaintId, 
        linkedFirId, 
        preventiveFlag: isFlagged,
        preventiveReason: isFlagged ? reason : null,
        attachmentUrl
      }
    });

    res.status(201).json(newEntry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create GD entry' });
  }
});

// PATCH a GD entry
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    
    if (body.gdDate) {
      body.gdDate = new Date(body.gdDate);
    }
    
    const updatedUser = await prisma.smartGDEntry.update({
      where: { id: Number(id) },
      data: body
    });
    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

export default router;
