declare module "pdf-parse" {
  // pdf-parse has no bundled types in some setups; we treat it as `any`.
  const pdfParse: any;
  export default pdfParse;
}

declare module "pdf-parse/lib/pdf-parse" {
  const pdfParse: any;
  export default pdfParse;
}

