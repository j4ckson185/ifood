// netlify/functions/test.js
exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({message: "Test function is working!"}),
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  };
};
