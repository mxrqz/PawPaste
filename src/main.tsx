import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// (async () => {
//   const asyncApp = await App(); // Chamando a função assíncrona e esperando sua resolução
//   ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
//     <React.StrictMode>
//       {asyncApp}
//     </React.StrictMode>
//   );
// })();