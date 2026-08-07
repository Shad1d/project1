import { useState } from "react";

function Demo() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const sendData = async () => {
    const response = await fetch("http://localhost:5000/api/greet", {
      method: "POST",
      // GET
      // PUT
      // DELETE
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name,
      }),
    });

    const data = await response.json();

    setMessage(data.message);
  };

  return (
    <div
      style={{
        width: "400px",
        margin: "50px auto",
        textAlign: "center",
      }}
    >
      <h1>React → Express Demo</h1>

      <input
        type="text"
        placeholder="Enter your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <br />
      <br />

      <button onClick={sendData}>Send</button>

      <h2>{message}</h2>
    </div>
  );
}

export default Demo;
