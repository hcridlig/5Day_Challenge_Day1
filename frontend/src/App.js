import React, { useState } from "react";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    
    setLoading(true);
    try {
      // Convert image to base64
      const base64Image = await convertToBase64(selectedFile);

      // Send request to backend
      const response = await fetch("http://localhost:5000/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Error:", error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-4">Détection de Logo</h1>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <input type="file" accept="image/*" onChange={handleFileChange} className="mb-4" />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          disabled={loading}
        >
          {loading ? "Analyse en cours..." : "Uploader et détecter"}
        </button>
      </form>

      {result && result.result && (
        <div className="mt-4 text-center">
          <h2 className="text-xl font-semibold">Résultat de la Détection</h2>
          <img
            src={`data:image/jpeg;base64,${result.result}`}
            alt="Résultat de la détection"
            className="mt-4 max-w-md mx-auto"
          />
        </div>
      )}

      {result?.error && (
        <div className="mt-4 text-red-500">
          <p>Erreur: {result.error}</p>
        </div>
      )}
    </div>
  );
}

export default App;
