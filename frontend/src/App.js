import React, { useState } from 'react';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    setLoading(true);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await fetch('http://localhost:5000/api/detect', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Erreur:', error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-4">Détection de Logo</h1>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="mb-4"
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          disabled={loading}
        >
          {loading ? 'Analyse en cours...' : 'Uploader et détecter'}
        </button>
      </form>

      {result && (
        <div className="mt-4 text-center">
          <h2 className="text-xl font-semibold">Logo détecté : {result.company}</h2>
          <p>Score de confiance : {(result.score * 100).toFixed(2)}%</p>
          {result.processedImage && (
            <img
              src={result.processedImage}
              alt="Résultat de la détection"
              className="mt-4 max-w-md mx-auto"
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
