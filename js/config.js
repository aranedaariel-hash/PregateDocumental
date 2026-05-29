// ══ CREDENCIALES ══
const CLIENT_ID = '491607847299-lo03fhrvlgkc8v31a1sl62qv82v9j3c9.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
const DRIVE_FOLDER_NAME = 'Documentacion-Transporte';
const STATE_FILE_NAME = 'estado.json';

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

// ══ LOGIN ══
const USERS = [
  {user:'auditor', pass:'1234', role:'admin'},
];
