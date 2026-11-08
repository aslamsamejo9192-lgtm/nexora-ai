// Tells the page whether the site's own keys are configured.
// GET /api/status -> { gemini: true | false, voice: true | false }
module.exports = function (req, res) {
  res.status(200).json({ gemini: !!process.env.GEMINI_API_KEY, voice: !!process.env.OPENROUTER_API_KEY });
};
