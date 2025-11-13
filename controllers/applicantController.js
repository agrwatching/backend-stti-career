// controllers/applicantController.js
const db = require("../config/database");

// 🔹 NEW: pelamar melihat tracking lamaran miliknya
exports.getMyApplications = async (req, res) => {
  try {
    const userId = req.user.id; // id user dari token
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(
      1,
      Math.min(parseInt(req.query.limit, 10) || 10, 50)
    );
    const offset = (page - 1) * limit;

    const sql = `
      SELECT 
        a.id,
        a.job_id,
        a.pelamar_id,
        a.status,
        a.cover_letter,
        a.notes,
        a.applied_at,
        j.title       AS job_title,
        j.location,
        j.salary_range,
        c.nama_companies AS company_name,
        p.full_name,
        p.cv_file
      FROM applications a
      JOIN job_posts j       ON a.job_id = j.id
      LEFT JOIN companies c  ON j.company_id = c.id
      LEFT JOIN pelamar_profiles p ON p.user_id = a.pelamar_id
      WHERE a.pelamar_id = ?
      ORDER BY a.applied_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(sql, [userId, limit, offset]);

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM applications WHERE pelamar_id = ?`,
      [userId]
    );

    res.json({
      success: true,
      page,
      limit,
      total: countRows[0]?.total || 0,
      data: rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ FIXED: HR hanya bisa melihat pelamar dari lowongan miliknya sendiri
exports.getAllJobApplicants = async (req, res) => {
  try {
    const user = req.user; // HR dari token login
    const { pelamarId, jobId, status } = req.query;

    let sql = `
      SELECT 
        c.nama_companies AS company_name,
        a.id,
        p.full_name AS nama,
        a.applied_at AS tanggal,
        p.cv_file AS cv,
        a.resume_file,
        j.title AS posisi,
        a.status,
        a.cover_letter,
        a.notes
      FROM applications a
      JOIN pelamar_profiles p ON a.pelamar_id = p.id
      JOIN job_posts j ON a.job_id = j.id
      LEFT JOIN companies c ON j.company_id = c.id
      WHERE 1=1
    `;
    const values = [];

    // 🔹 Filter otomatis untuk HR
    // Hanya menampilkan pelamar yang melamar ke job milik HR yang login
    if (user.role === "hr") {
      sql += " AND j.hr_id = ?";
      values.push(user.id);
    }

    // 🔹 Filter tambahan opsional (kalau admin ingin pakai query param)
    if (pelamarId) {
      sql += " AND a.pelamar_id = ?";
      values.push(pelamarId);
    }
    if (jobId) {
      sql += " AND a.job_id = ?";
      values.push(jobId);
    }
    if (status) {
      sql += " AND a.status = ?";
      values.push(status);
    }

    sql += " ORDER BY a.applied_at DESC";

    const [results] = await db.query(sql, values);
    res.json({ success: true, data: results });
  } catch (err) {
    console.error("getAllJobApplicants error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};


// GET job applicant by ID
// ✅ HR melihat detail pelamar yang melamar ke lowongan
exports.getJobApplicantById = async (req, res) => {
  const { id } = req.params;

  try {
    const sql = `
      SELECT 
        a.id AS application_id,
        a.job_id,
        a.status,
        a.cover_letter,
        a.resume_file,
        a.cover_letter_file,
        a.portfolio_file,
        a.applied_at,
        j.title AS posisi,
        j.location,
        j.salary_range,
        u.full_name,
        u.email,
        u.phone,
        u.address,
        p.education_level,
        p.major,
        p.institution_name,
        p.gpa,
        p.graduation_year,
        p.entry_year,
        p.cv_file,
        p.cover_letter_file AS cover_file,
        p.portfolio_file AS port_file,
        p.profile_photo,
        p.id AS pelamar_id,
        u.id AS user_id
      FROM applications a
      JOIN pelamar_profiles p ON a.pelamar_id = p.id
      JOIN users u ON p.user_id = u.id
      JOIN job_posts j ON j.id = a.job_id
      WHERE a.id = ?
      LIMIT 1
    `;

    const [rows] = await db.query(sql, [id]);
    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Pelamar tidak ditemukan" });
    }

    const data = rows[0];
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    data.cv_file_url = data.cv_file
      ? `${baseUrl}/uploads/files/${data.cv_file}`
      : null;
    data.cover_letter_file_url = data.cover_file
      ? `${baseUrl}/uploads/files/${data.cover_file}`
      : null;
    data.portfolio_file_url = data.port_file
      ? `${baseUrl}/uploads/files/${data.port_file}`
      : null;
    data.profile_photo_url = data.profile_photo
      ? `${baseUrl}/uploads/images/${data.profile_photo}`
      : null;

    // 🔹 ambil work_experiences & certificates dari pelamar
    const [experiences] = await db.query(
      "SELECT company_name, position, start_date, end_date, job_description FROM work_experiences WHERE user_id = ?",
      [data.user_id]
    );

    const [certificates] = await db.query(
      "SELECT certificate_name, issuer, issue_date, expiry_date, certificate_file FROM certificates WHERE user_id = ?",
      [data.user_id]
    );

    data.work_experiences = experiences;
    data.certificates = certificates.map((c) => ({
      ...c,
      certificate_file_url: c.certificate_file
        ? `${baseUrl}/uploads/files/${c.certificate_file}`
        : null,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error("getJobApplicantById error:", err);
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server" });
  }
};

// POST new job applicant
exports.createJobApplicant = async (req, res) => {
  const { job_id, user_id, cover_letter, status, notes } = req.body;
  if (!job_id || !user_id) {
    return res.status(400).json({ message: "Job ID dan User ID diperlukan" });
  }
  try {
    const [result] = await db.query(
      "INSERT INTO applications (job_id, pelamar_id, cover_letter, status, notes) VALUES (?, ?, ?, ?, ?)",
      [job_id, user_id, cover_letter || "", status || "pending", notes || ""]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        job_id,
        pelamar_id: user_id,
        cover_letter: cover_letter || "",
        status: status || "pending",
        notes: notes || "",
        applied_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// UPDATE job applicant status or notes
exports.updateJobApplicantStatus = async (req, res) => {
  const { id } = req.params;
  const { status, notes, reviewed_by } = req.body;

  if (!["pending", "accepted", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    const [result] = await db.query(
      "UPDATE applications SET status = ?, notes = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ?",
      [status, notes, reviewed_by, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    res.json({ message: `Applicant status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE job applicant
exports.deleteJobApplicant = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query("DELETE FROM applications WHERE id = ?", [
      id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    res.json({ message: "Applicant deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ HR melihat daftar pelamar atau detail pelamar berdasarkan ID lamaran
// controllers/applicantController.js
exports.getApplicantDetailByApplicationId = async (req, res) => {
  const { application_id } = req.params;
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  try {
    let sql = `
      SELECT 
        a.id AS application_id,
        a.job_id,
        a.pelamar_id,
        a.status,
        a.cover_letter,
        a.applied_at,
        a.resume_file,
        a.cover_letter_file,
        a.portfolio_file,
        a.notes,
        a.reviewed_at,
        a.reviewed_by,
        a.created_at AS application_created_at,
        a.updated_at AS application_updated_at,

        j.title AS posisi,
        p.education_level,
        p.major,
        p.institution_name,
        p.gpa,
        p.graduation_year,
        p.entry_year,
        p.cv_file,
        p.cover_letter_file AS profile_cover_letter_file,
        p.portfolio_file AS profile_portfolio_file,
        p.profile_photo,
        p.id AS pelamar_profile_id,

        u.id AS user_id,
        u.full_name,
        u.email,
        u.phone,
        u.address

      FROM applications a
      JOIN pelamar_profiles p ON a.pelamar_id = p.id
      JOIN users u ON p.user_id = u.id
      JOIN job_posts j ON j.id = a.job_id
      WHERE 1=1
    `;

    const values = [];

    // kalau ada parameter ID
    if (application_id) {
      sql += " AND a.id = ?";
      values.push(application_id);
    }

    sql += " ORDER BY a.applied_at DESC";

    const [rows] = await db.query(sql, values);

    if (!rows.length) {
      return res.json({ success: true, data: [] });
    }

    const results = await Promise.all(
      rows.map(async (row) => {
        // tambahkan URL file otomatis
        row.resume_file_url = row.resume_file
          ? `${baseUrl}/uploads/files/${row.resume_file}`
          : null;
        row.cover_letter_file_url = row.cover_letter_file
          ? `${baseUrl}/uploads/files/${row.cover_letter_file}`
          : null;
        row.portfolio_file_url = row.portfolio_file
          ? `${baseUrl}/uploads/files/${row.portfolio_file}`
          : null;
        row.profile_photo_url = row.profile_photo
          ? `${baseUrl}/uploads/images/${row.profile_photo}`
          : null;

        // ambil pengalaman kerja
        const [work_experiences] = await db.query(
          "SELECT company_name, position, start_date, end_date, job_description FROM work_experiences WHERE user_id = ?",
          [row.user_id]
        );

        // ambil sertifikat
        const [certificates] = await db.query(
          "SELECT certificate_name, issuer, issue_date, expiry_date, certificate_file FROM certificates WHERE user_id = ?",
          [row.user_id]
        );

        row.work_experiences = work_experiences;
        row.certificates = certificates.map((c) => ({
          ...c,
          certificate_file_url: c.certificate_file
            ? `${baseUrl}/uploads/files/${c.certificate_file}`
            : null,
        }));

        return row;
      })
    );

    return res.json({ success: true, data: results });
  } catch (err) {
    console.error("getApplicantDetailByApplicationId error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server" });
  }
};