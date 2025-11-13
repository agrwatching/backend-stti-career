// routes/applicant.js
const express = require('express');
const router = express.Router();
const applicantController = require('../controllers/applicantController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// 🔹 Pelamar ambil tracking lamarannya sendiri
router.get('/me', authenticateToken, requireRole('pelamar','user'), applicantController.getMyApplications);

// 🔹 Info pelamar (HR/Admin)
router.get('/detail', authenticateToken, requireRole('hr','admin'), applicantController.getApplicantDetailByApplicationId);
router.get('/detail/:application_id', authenticateToken, requireRole('hr','admin'), applicantController.getApplicantDetailByApplicationId);

// 🔹 Semua pelamar (HR/Admin)
router.get('/', authenticateToken, requireRole('admin','hr'), applicantController.getAllJobApplicants);
router.get('/:id', authenticateToken, requireRole('admin','hr'), applicantController.getJobApplicantById);

// 🔹 CRUD Applicant (HR)
router.post('/', authenticateToken, requireRole('hr'), applicantController.createJobApplicant);
router.put('/:id', authenticateToken, requireRole('hr'), applicantController.updateJobApplicantStatus);
router.delete('/:id', authenticateToken, requireRole('hr'), applicantController.deleteJobApplicant);

module.exports = router;
