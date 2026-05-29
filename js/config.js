// ══ SUPABASE ══
const SUPABASE_URL = 'https://hgeevmzxfywyzvfyfsmt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnZWV2bXp4Znl3eXp2Znlmc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMDg1OTQsImV4cCI6MjA5NTU4NDU5NH0.JQnm4pMMl1gxiP8gZZy_YN74GeyN1SBsB5Ef82X7wwM';

// ══ CONFIG DOCS ══
const DOCS = {
  chofer:[
    {id:'lic',name:'Licencia de conducir',required:true},
    {id:'art',name:'ART',required:true},
    {id:'f931',name:'F931',required:false},
    {id:'clausula',name:'Cláusula de no repetición',required:false},
  ],
  tractor:[
    {id:'cedverde',name:'Cédula verde',required:true},
    {id:'vtv',name:'VTV / RTO',required:true},
    {id:'seguro',name:'Seguro',required:true},
    {id:'lideuda',name:'Libre de deuda',required:false},
  ],
  semi:[
    {id:'cedverde',name:'Cédula verde',required:true},
    {id:'vtv',name:'VTV / RTO',required:true},
    {id:'seguro',name:'Seguro',required:true},
    {id:'lideuda',name:'Libre de deuda',required:false},
  ],
  transporte:[
    {id:'nominaart',name:'Nómina ART',required:true},
    {id:'f931',name:'F931',required:true},
    {id:'poliza',name:'Póliza de seguros flota',required:true},
    {id:'clausula',name:'Cláusula de no repetición',required:false},
  ],
};
const SECTION_LABELS = {chofer:'Transportistas',tractor:'Tractores',semi:'Semirremolques',transporte:'Transportes'};
const SUBFOLDER = {chofer:'Choferes',tractor:'Tractores',semi:'Semis',transporte:'Transportes'};

// Docs that never expire (cédula verde = lifetime document)
const NEVER_EXPIRE_DOCS = new Set(['cedverde']);
