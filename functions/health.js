exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
  }
  return { statusCode: 405, body: "Method Not Allowed" };
};
