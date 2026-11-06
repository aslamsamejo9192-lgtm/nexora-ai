// Tells the page whether the site's own Gemini key is configured.
// GET /api/status -> { gemini: true | false }
module.exports = function (req, res) {
  res.status(200).json({ gemini: !!process.env.GEMINI_API_KEY });
};
