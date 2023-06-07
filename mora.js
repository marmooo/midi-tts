import { hiraToRoma } from "https://raw.githubusercontent.com/marmooo/hiraroma/main/mod.js";

const textIn = Deno.readTextFileSync("mora.lst");
let textOut = "";
textIn.trimEnd().split("\n").forEach((line, i) => {
  const instrument = String(i).padStart(3, "0");
  const roma = hiraToRoma(line);
  textOut += `${instrument},${line},${roma}\n`;
});
Deno.writeTextFileSync("mora.csv", textOut);
