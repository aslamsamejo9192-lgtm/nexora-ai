// Proxies Gemini image generation through the site's own server key.
// POST /api/image { model, body } -> Google's :predict (Imagen) or
// :generateContent (Gemini image models). Google's JSON is returned as-is,
// so the page's existing response parsing works unchanged.
// The key lives only in the GEMINI_API_KEY env var — never in the page.
var ALLOWED_IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "imagen-4.0-generate-001",
  "imagen-4.0-fast-generate-001"
];

module.exports = async function (req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed." } });
    return;
  }
  var key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(503).json({
      error: {
        code: "KEY_NOT_CONFIGURED",
        message: "The site's Gemini key isn't set up yet. The site owner needs to add GEMINI_API_KEY in the hosting settings."
      }
    });
    return;
  }
  var data = req.body || {};
  var model = data.model;
  if (ALLOWED_IMAGE_MODELS.indexOf(model) === -1) {
    res.status(400).json({ error: { message: "Unknown image model." } });
    return;
  }
  var isImagen = model.indexOf("imagen") === 0;
  var url = "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) + (isImagen ? ":predict" : ":generateContent");
  try {
    var upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(data.body || {})
    });
    var text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: { message: "Could not reach Google's API. Try again in a moment." } });
  }
};
