export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      message: "Backend GET test works"
    });
  }

  if (req.method === "POST") {
    return res.status(200).json({
      success: true,
      message: "Backend received POST from Wix",
      body: req.body || null
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
