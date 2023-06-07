const indir = Deno.args[0];
const outdir = Deno.args[1];
const moraText = Deno.readTextFileSync("mora.csv");
const moraList = moraText.trimEnd().split("\n").map((line) => {
  const arr = line.split(",");
  return { instrument:arr[0], hira:arr[1], roma:arr[2] };
});

Deno.mkdirSync(outdir, { recursive: true });
moraList.forEach((mora) => {
  const i = String(mora.instrument).padStart(3, "0");
  const inPath = `${indir}/${mora.hira}.wav`;
  const outPath = `${outdir}/000-${i}-${mora.roma}.wav`;
  Deno.copyFileSync(inPath, outPath);
});
