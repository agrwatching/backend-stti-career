// controllers/userManagementController.js
const bcrypt = require("bcrypt");
const { db } = require("../config/database");

/**
 * Admin mengganti password user lain (HR / Pelamar)
 */
const adminResetPassword = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password baru minimal 6 karakter",
      });
    }

    // Cek user
    const [rows] = await db.query(
      "SELECT id, email, role, full_name FROM users WHERE id = ? LIMIT 1",
      [user_id]
    );
    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan" });
    }
    const user = rows[0];

    // Hash password baru
    const hashed = await bcrypt.hash(new_password, 12);

    // Update ke database
    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      hashed,
      user_id,
    ]);

    // Simpan log admin (optional)
    try {
      await db.query(
        `INSERT INTO admin_activity_logs (admin_id, action, target_type, target_id, note)
         VALUES (?, 'update_user_password', 'user', ?, ?)`,
        [req.user.id, user_id, `Reset password ${user.email}`]
      );
    } catch {}

    res.json({
      success: true,
      message: `Password user ${user.full_name} (${user.role}) berhasil direset.`,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server",
    });
  }
};

/**
 * HR/Pelamar ubah password sendiri (tanpa admin)
 */
const userChangeOwnPassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;

    if (!current_password || !new_password) {
      return res
        .status(400)
        .json({ success: false, message: "Lengkapi semua kolom" });
    }

    const [rows] = await db.query(
      "SELECT password FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    if (!rows.length)
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan" });

    const match = await bcrypt.compare(current_password, rows[0].password);
    if (!match)
      return res
        .status(400)
        .json({ success: false, message: "Password lama salah" });

    if (new_password.length < 6)
      return res
        .status(400)
        .json({ success: false, message: "Password baru minimal 6 karakter" });

    const hashed = await bcrypt.hash(new_password, 12);
    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      hashed,
      userId,
    ]);

    res.json({
      success: true,
      message: "Password berhasil diperbarui",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan server" });
  }
};

module.exports = { adminResetPassword, userChangeOwnPassword };