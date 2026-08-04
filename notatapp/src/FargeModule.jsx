import { useState, useRef } from "react";

/* ── Fargedatabasar (frå arkitektverktoy.html) ──────────── */
var RAL_COLORS = [{code:"RAL 1000",name:"Grøngul",hex:"#BEBD7F"},{code:"RAL 1001",name:"Beige",hex:"#C2B078"},
  {code:"RAL 1002",name:"Sandgul",hex:"#C6A664"},{code:"RAL 1003",name:"Signalgul",hex:"#E5BE01"},
  {code:"RAL 1004",name:"Gullgul",hex:"#CDA434"},{code:"RAL 1005",name:"Honninggul",hex:"#A98307"},
  {code:"RAL 1006",name:"Maisgul",hex:"#E4A010"},{code:"RAL 1007",name:"Narsissgul",hex:"#DC9D00"},
  {code:"RAL 1011",name:"Brunbeige",hex:"#8A6642"},{code:"RAL 1012",name:"Sitrongul",hex:"#C7B446"},
  {code:"RAL 1013",name:"Østerskvit",hex:"#EAE6CA"},{code:"RAL 1014",name:"Elfenbein",hex:"#E1CC4F"},
  {code:"RAL 1015",name:"Lys elfenbein",hex:"#E6D690"},{code:"RAL 1016",name:"Svovlegul",hex:"#EDFF21"},
  {code:"RAL 1017",name:"Safrrangul",hex:"#F5D033"},{code:"RAL 1018",name:"Zinkgul",hex:"#F8F32B"},
  {code:"RAL 1019",name:"Grågul",hex:"#9E9764"},{code:"RAL 1020",name:"Olivegul",hex:"#999950"},
  {code:"RAL 1021",name:"Rapesgul",hex:"#F3DA0B"},{code:"RAL 1023",name:"Trafikkgul",hex:"#FAD201"},
  {code:"RAL 1024",name:"Okergul",hex:"#AEA04B"},{code:"RAL 1026",name:"Lysande gul",hex:"#FFFF00"},
  {code:"RAL 1027",name:"Karriegul",hex:"#9D9101"},{code:"RAL 1028",name:"Meloningul",hex:"#F4A900"},
  {code:"RAL 1032",name:"Ginsterblomstgul",hex:"#D6AE01"},{code:"RAL 1033",name:"Dahliagul",hex:"#F3A505"},
  {code:"RAL 1034",name:"Pastellgul",hex:"#EFA94A"},{code:"RAL 1037",name:"Solgul",hex:"#F39F18"},
  {code:"RAL 2000",name:"Gulappelsin",hex:"#ED760E"},{code:"RAL 2001",name:"Raudappelsin",hex:"#C93C20"},
  {code:"RAL 2002",name:"Blodappelsin",hex:"#CB2821"},{code:"RAL 2003",name:"Pastellappelsin",hex:"#FF7514"},
  {code:"RAL 2004",name:"Reinappelsin",hex:"#F44611"},{code:"RAL 2008",name:"Lys raud appelsin",hex:"#F75E25"},
  {code:"RAL 2009",name:"Trafikkappelsin",hex:"#F54021"},{code:"RAL 2010",name:"Signalappelsin",hex:"#D84B20"},
  {code:"RAL 2011",name:"Djupappelsin",hex:"#EC7C26"},{code:"RAL 2012",name:"Laksappelsin",hex:"#E55137"},
  {code:"RAL 3000",name:"Flammeraud",hex:"#AF2B1E"},{code:"RAL 3001",name:"Signalraud",hex:"#A52019"},
  {code:"RAL 3002",name:"Karminraud",hex:"#A2231D"},{code:"RAL 3003",name:"Rubinraud",hex:"#9B111E"},
  {code:"RAL 3004",name:"Purpurraud",hex:"#75151E"},{code:"RAL 3005",name:"Vinraud",hex:"#5E2129"},
  {code:"RAL 3007",name:"Svartlaude raud",hex:"#412227"},{code:"RAL 3009",name:"Oksidraud",hex:"#642424"},
  {code:"RAL 3011",name:"Brunraud",hex:"#781F19"},{code:"RAL 3012",name:"Beige raud",hex:"#C1876B"},
  {code:"RAL 3013",name:"Tomatraud",hex:"#A12312"},{code:"RAL 3014",name:"Antikvit raud",hex:"#D36E70"},
  {code:"RAL 3015",name:"Lysrosa",hex:"#EA899A"},{code:"RAL 3016",name:"Koralraud",hex:"#B32821"},
  {code:"RAL 3017",name:"Rosa",hex:"#E63244"},{code:"RAL 3018",name:"Jordbærraud",hex:"#D53032"},
  {code:"RAL 3020",name:"Trafikkraud",hex:"#CC0605"},{code:"RAL 3022",name:"Laksraud",hex:"#D95030"},
  {code:"RAL 3027",name:"Himberraud",hex:"#C51D34"},{code:"RAL 3028",name:"Reinraud",hex:"#CB3234"},
  {code:"RAL 3031",name:"Orientraud",hex:"#B32428"},
  {code:"RAL 4001",name:"Raudlila",hex:"#6D3F5B"},{code:"RAL 4002",name:"Raudviolett",hex:"#922B3E"},
  {code:"RAL 4003",name:"Erikaviolett",hex:"#DE4C8A"},{code:"RAL 4004",name:"Bordeauxviolett",hex:"#641C34"},
  {code:"RAL 4005",name:"Blålila",hex:"#6C4675"},{code:"RAL 4006",name:"Trafikkpurpur",hex:"#A03472"},
  {code:"RAL 4007",name:"Purpurviolett",hex:"#4A192C"},{code:"RAL 4008",name:"Signalviolett",hex:"#924E7D"},
  {code:"RAL 4009",name:"Pastellviolett",hex:"#A18594"},{code:"RAL 4010",name:"Telemagenta",hex:"#CF3476"},
  {code:"RAL 5000",name:"Violettblå",hex:"#354D73"},{code:"RAL 5001",name:"Grønblå",hex:"#1F3438"},
  {code:"RAL 5002",name:"Ultramarin",hex:"#20214F"},{code:"RAL 5003",name:"Safirblå",hex:"#1D1E33"},
  {code:"RAL 5004",name:"Svartblå",hex:"#18171C"},{code:"RAL 5005",name:"Signalblå",hex:"#1E2460"},
  {code:"RAL 5007",name:"Brilliantblå",hex:"#3E5F8A"},{code:"RAL 5008",name:"Grablå",hex:"#26252D"},
  {code:"RAL 5009",name:"Azurblå",hex:"#025669"},{code:"RAL 5010",name:"Gentianblå",hex:"#0E294B"},
  {code:"RAL 5012",name:"Lysblå",hex:"#3B83BD"},{code:"RAL 5013",name:"Koboltblå",hex:"#1E213D"},
  {code:"RAL 5014",name:"Dueblå",hex:"#606E8C"},{code:"RAL 5015",name:"Himmelsblå",hex:"#2271BB"},
  {code:"RAL 5017",name:"Trafikkblå",hex:"#063971"},{code:"RAL 5018",name:"Turkisblå",hex:"#3F888F"},
  {code:"RAL 5019",name:"Capriblå",hex:"#1B5583"},{code:"RAL 5020",name:"Havblå",hex:"#1D334A"},
  {code:"RAL 5021",name:"Vassblå",hex:"#256D7B"},{code:"RAL 5022",name:"Nattblå",hex:"#252850"},
  {code:"RAL 5023",name:"Fjernblå",hex:"#49678D"},{code:"RAL 5024",name:"Pastellblå",hex:"#5D9B9B"},
  {code:"RAL 6000",name:"Patinagrøn",hex:"#316650"},{code:"RAL 6001",name:"Smaragdgrøn",hex:"#287233"},
  {code:"RAL 6002",name:"Lauvsortgrøn",hex:"#2D572C"},{code:"RAL 6003",name:"Olivegrøn",hex:"#424632"},
  {code:"RAL 6004",name:"Blågrøn",hex:"#1F3A3D"},{code:"RAL 6005",name:"Mossgrøn",hex:"#2F4538"},
  {code:"RAL 6006",name:"Graboliv",hex:"#3E3B32"},{code:"RAL 6007",name:"Flaskegrøn",hex:"#343B29"},
  {code:"RAL 6008",name:"Brungrøn",hex:"#39352A"},{code:"RAL 6009",name:"Grangrøn",hex:"#31372B"},
  {code:"RAL 6010",name:"Grasgrøn",hex:"#35682D"},{code:"RAL 6011",name:"Resedagrøn",hex:"#587246"},
  {code:"RAL 6012",name:"Svartgrøn",hex:"#343E40"},{code:"RAL 6013",name:"Sivsgrøn",hex:"#6C7156"},
  {code:"RAL 6016",name:"Turkisgrøn",hex:"#1E5945"},{code:"RAL 6017",name:"Maigrøn",hex:"#4C9141"},
  {code:"RAL 6018",name:"Gulgrøn",hex:"#57A639"},{code:"RAL 6019",name:"Kvitgrøn",hex:"#BDECB6"},
  {code:"RAL 6021",name:"Pastellgrøn",hex:"#89AC76"},{code:"RAL 6024",name:"Trafikkgrøn",hex:"#308446"},
  {code:"RAL 6025",name:"Bregncgrøn",hex:"#3D6B35"},{code:"RAL 6027",name:"Lysgrøn",hex:"#83C88A"},
  {code:"RAL 6029",name:"Mintgrøn",hex:"#20603D"},{code:"RAL 6032",name:"Signalgrøn",hex:"#317F43"},
  {code:"RAL 6033",name:"Minttúrkis",hex:"#497E76"},{code:"RAL 6034",name:"Pastelltúrkis",hex:"#7FB5B5"},
  {code:"RAL 6037",name:"Reingrøn",hex:"#008F39"},
  {code:"RAL 7000",name:"Farregra",hex:"#78858B"},{code:"RAL 7001",name:"Søvgra",hex:"#8A9597"},
  {code:"RAL 7002",name:"Olivegra",hex:"#817F68"},{code:"RAL 7003",name:"Mossgra",hex:"#6C7059"},
  {code:"RAL 7004",name:"Signalgra",hex:"#969992"},{code:"RAL 7005",name:"Musgra",hex:"#646B63"},
  {code:"RAL 7006",name:"Beirgra",hex:"#6D6552"},{code:"RAL 7008",name:"Khakigra",hex:"#6A5F31"},
  {code:"RAL 7009",name:"Grønngra",hex:"#4D5645"},{code:"RAL 7010",name:"Presenninggra",hex:"#4C514A"},
  {code:"RAL 7011",name:"Jarngrå",hex:"#434B4D"},{code:"RAL 7012",name:"Basaltgra",hex:"#4E5754"},
  {code:"RAL 7013",name:"Brungra",hex:"#464531"},{code:"RAL 7015",name:"Skifergra",hex:"#434750"},
  {code:"RAL 7016",name:"Antrasittgra",hex:"#293133"},{code:"RAL 7021",name:"Svartgra",hex:"#23282B"},
  {code:"RAL 7022",name:"Skymgra",hex:"#332F2C"},{code:"RAL 7023",name:"Betongra",hex:"#686C5E"},
  {code:"RAL 7024",name:"Grafittgra",hex:"#474A51"},{code:"RAL 7026",name:"Granittgra",hex:"#2F353B"},
  {code:"RAL 7030",name:"Steingrå",hex:"#8B8C7A"},{code:"RAL 7031",name:"Blågrå",hex:"#474B4E"},
  {code:"RAL 7032",name:"Kiselgrå",hex:"#B8B799"},{code:"RAL 7033",name:"Sementgrå",hex:"#7D8471"},
  {code:"RAL 7034",name:"Gulgra",hex:"#8F8B66"},{code:"RAL 7035",name:"Lysgrå",hex:"#D7D7D7"},
  {code:"RAL 7036",name:"Platinagra",hex:"#7F7679"},{code:"RAL 7037",name:"Støvgrå",hex:"#7D7F7D"},
  {code:"RAL 7038",name:"Agattgrå",hex:"#B5B8B1"},{code:"RAL 7039",name:"Kvartsgrå",hex:"#6C6960"},
  {code:"RAL 7040",name:"Vindusgrå",hex:"#9DA1AA"},{code:"RAL 7042",name:"Trafikkgrå A",hex:"#8D948D"},
  {code:"RAL 7043",name:"Trafikkgrå B",hex:"#4E5452"},{code:"RAL 7044",name:"Silkegrå",hex:"#CAC4B0"},
  {code:"RAL 7045",name:"Telegrå 1",hex:"#909090"},{code:"RAL 7046",name:"Telegrå 2",hex:"#82898F"},
  {code:"RAL 7047",name:"Telegrå 4",hex:"#D0D0D0"},{code:"RAL 7048",name:"Perlmusgra",hex:"#898176"},
  {code:"RAL 8000",name:"Grønbrun",hex:"#826C34"},{code:"RAL 8001",name:"Okrebrun",hex:"#955F20"},
  {code:"RAL 8002",name:"Signalbrun",hex:"#6C3B2A"},{code:"RAL 8003",name:"Leirbrun",hex:"#734222"},
  {code:"RAL 8004",name:"Koparbrun",hex:"#8E402A"},{code:"RAL 8007",name:"Raudyrebrun",hex:"#59351F"},
  {code:"RAL 8008",name:"Olivebrun",hex:"#6F4F28"},{code:"RAL 8011",name:"Nøttbrun",hex:"#5B3A29"},
  {code:"RAL 8012",name:"Raudbrun",hex:"#592321"},{code:"RAL 8014",name:"Sepibrun",hex:"#382C1E"},
  {code:"RAL 8015",name:"Kastanjebrun",hex:"#633A34"},{code:"RAL 8016",name:"Mahognibrun",hex:"#4C2F27"},
  {code:"RAL 8017",name:"Sjokoladebrun",hex:"#45322E"},{code:"RAL 8019",name:"Grybrun",hex:"#403A3A"},
  {code:"RAL 8022",name:"Svartbrun",hex:"#212121"},{code:"RAL 8023",name:"Appelsinbrun",hex:"#A65E2E"},
  {code:"RAL 8024",name:"Beigbrun",hex:"#79553D"},{code:"RAL 8025",name:"Paleybrun",hex:"#755C48"},
  {code:"RAL 8028",name:"Terrabrun",hex:"#4E3B31"},
  {code:"RAL 9001",name:"Kremkvit",hex:"#FDF4E3"},{code:"RAL 9002",name:"Grå-kvit",hex:"#E7EBDA"},
  {code:"RAL 9003",name:"Signalkvit",hex:"#F4F4F4"},{code:"RAL 9004",name:"Signalsvart",hex:"#282828"},
  {code:"RAL 9005",name:"Jettsvart",hex:"#0A0A0A"},{code:"RAL 9006",name:"Kvit aluminium",hex:"#A5A5A5"},
  {code:"RAL 9007",name:"Gra aluminium",hex:"#8F8F8F"},{code:"RAL 9010",name:"Reinkvit",hex:"#FFFFFF"},
  {code:"RAL 9011",name:"Grafittsvart",hex:"#1C1C1C"},{code:"RAL 9016",name:"Trafikkkvit",hex:"#F6F6F6"},
  {code:"RAL 9017",name:"Trafikksvart",hex:"#1E1E1E"},{code:"RAL 9018",name:"Papyruskvit",hex:"#D7D7D0"},
  {code:"RAL 9022",name:"Perlgra 1",hex:"#9E9E9E"},{code:"RAL 9023",name:"Perlgra 2",hex:"#808080"},];

var NCS_COLORS = [// Nøytralar
  {code:"NCS S 0000-N",name:"Kvit",hex:"#FFFFFF"},{code:"NCS S 0500-N",name:"Nær kvit",hex:"#F2F2F2"},
  {code:"NCS S 1000-N",name:"Veldig lys grå",hex:"#E5E5E5"},{code:"NCS S 2000-N",name:"Lys grå",hex:"#CCCCCC"},
  {code:"NCS S 3000-N",name:"Lys mellomgrå",hex:"#B2B2B2"},{code:"NCS S 4000-N",name:"Mellomgrå",hex:"#999999"},
  {code:"NCS S 5000-N",name:"Mørk mellomgrå",hex:"#7F7F7F"},{code:"NCS S 6000-N",name:"Mørk grå",hex:"#666666"},
  {code:"NCS S 7000-N",name:"Veldig mørk grå",hex:"#4C4C4C"},{code:"NCS S 8000-N",name:"Nær svart",hex:"#323232"},
  {code:"NCS S 9000-N",name:"Svart",hex:"#191919"},
  // S 0530 — veldig lys
  {code:"NCS S 0530-Y",name:"Veldig lys gul",hex:"#F2F2A6"},{code:"NCS S 0530-Y30R",name:"Veldig lys gulraud",hex:"#F2DBA6"},
  {code:"NCS S 0530-Y60R",name:"Veldig lys appelsin",hex:"#F2C4A6"},{code:"NCS S 0530-R",name:"Veldig lys raud",hex:"#F2A6A6"},
  {code:"NCS S 0530-R30B",name:"Veldig lys raudblå",hex:"#DBA6BD"},{code:"NCS S 0530-R60B",name:"Veldig lys lilla",hex:"#C4A6D4"},
  {code:"NCS S 0530-B",name:"Veldig lys blå",hex:"#A6A6F2"},{code:"NCS S 0530-B30G",name:"Veldig lys blågrøn",hex:"#A6BDDB"},
  {code:"NCS S 0530-B60G",name:"Veldig lys turkis",hex:"#A6D4C4"},{code:"NCS S 0530-G",name:"Veldig lys grøn",hex:"#A6F2A6"},
  {code:"NCS S 0530-G30Y",name:"Veldig lys grøngul",hex:"#BDF2A6"},{code:"NCS S 0530-G60Y",name:"Veldig lys gulgrøn",hex:"#D4F2A6"},
  // S 1030 — lys
  {code:"NCS S 1030-Y",name:"Lys gul",hex:"#E6E699"},{code:"NCS S 1030-Y30R",name:"Lys gulraud",hex:"#E6CF99"},
  {code:"NCS S 1030-Y60R",name:"Lys appelsin",hex:"#E6B899"},{code:"NCS S 1030-R",name:"Lys raud",hex:"#E69999"},
  {code:"NCS S 1030-R30B",name:"Lys raudblå",hex:"#CF99B0"},{code:"NCS S 1030-R60B",name:"Lys lilla",hex:"#B899C7"},
  {code:"NCS S 1030-B",name:"Lys blå",hex:"#9999E6"},{code:"NCS S 1030-B30G",name:"Lys blågrøn",hex:"#99B0CF"},
  {code:"NCS S 1030-B60G",name:"Lys turkis",hex:"#99C7B8"},{code:"NCS S 1030-G",name:"Lys grøn",hex:"#99E699"},
  {code:"NCS S 1030-G30Y",name:"Lys grøngul",hex:"#B0E699"},{code:"NCS S 1030-G60Y",name:"Lys gulgrøn",hex:"#C7E699"},
  // S 2050 — middels sterk
  {code:"NCS S 2050-Y",name:"Middels sterk gul",hex:"#CCCC4D"},{code:"NCS S 2050-Y30R",name:"Middels sterk gulraud",hex:"#CCA64D"},
  {code:"NCS S 2050-Y60R",name:"Middels sterk appelsin",hex:"#CC804D"},{code:"NCS S 2050-R",name:"Middels sterk raud",hex:"#CC4D4D"},
  {code:"NCS S 2050-R30B",name:"Middels sterk raudblå",hex:"#A64D73"},{code:"NCS S 2050-R60B",name:"Middels sterk lilla",hex:"#804D99"},
  {code:"NCS S 2050-B",name:"Middels sterk blå",hex:"#4D4DCC"},{code:"NCS S 2050-B30G",name:"Middels sterk blågrøn",hex:"#4D73A6"},
  {code:"NCS S 2050-B60G",name:"Middels sterk turkis",hex:"#4D9980"},{code:"NCS S 2050-G",name:"Middels sterk grøn",hex:"#4DCC4D"},
  {code:"NCS S 2050-G30Y",name:"Middels sterk grøngul",hex:"#73CC4D"},{code:"NCS S 2050-G60Y",name:"Middels sterk gulgrøn",hex:"#99CC4D"},
  // S 3050 — middels mørk sterk
  {code:"NCS S 3050-Y",name:"Mørk sterk gul",hex:"#B2B233"},{code:"NCS S 3050-Y30R",name:"Mørk sterk gulraud",hex:"#B28C33"},
  {code:"NCS S 3050-Y60R",name:"Mørk sterk appelsin",hex:"#B26633"},{code:"NCS S 3050-R",name:"Mørk sterk raud",hex:"#B23333"},
  {code:"NCS S 3050-R30B",name:"Mørk sterk raudblå",hex:"#8C3359"},{code:"NCS S 3050-R60B",name:"Mørk sterk lilla",hex:"#66337F"},
  {code:"NCS S 3050-B",name:"Mørk sterk blå",hex:"#3333B2"},{code:"NCS S 3050-B30G",name:"Mørk sterk blågrøn",hex:"#33598C"},
  {code:"NCS S 3050-B60G",name:"Mørk sterk turkis",hex:"#337F66"},{code:"NCS S 3050-G",name:"Mørk sterk grøn",hex:"#33B233"},
  {code:"NCS S 3050-G30Y",name:"Mørk sterk grøngul",hex:"#59B233"},{code:"NCS S 3050-G60Y",name:"Mørk sterk gulgrøn",hex:"#7FB233"},
  // S 4030 — mørk middels
  {code:"NCS S 4030-Y",name:"Mørk middels gul",hex:"#99994C"},{code:"NCS S 4030-Y30R",name:"Mørk middels gulraud",hex:"#99824C"},
  {code:"NCS S 4030-R",name:"Mørk middels raud",hex:"#994C4C"},{code:"NCS S 4030-R30B",name:"Mørk middels raudblå",hex:"#824C63"},
  {code:"NCS S 4030-B",name:"Mørk middels blå",hex:"#4C4C99"},{code:"NCS S 4030-B30G",name:"Mørk middels blågrøn",hex:"#4C6382"},
  {code:"NCS S 4030-G",name:"Mørk middels grøn",hex:"#4C994C"},{code:"NCS S 4030-G30Y",name:"Mørk middels grøngul",hex:"#63994C"},
  // S 5020 — djup dempet
  {code:"NCS S 5020-Y",name:"Djup dempet gul",hex:"#80804C"},{code:"NCS S 5020-Y30R",name:"Djup dempet gulraud",hex:"#806B4C"},
  {code:"NCS S 5020-R",name:"Djup dempet raud",hex:"#804C4C"},{code:"NCS S 5020-R30B",name:"Djup dempet raudblå",hex:"#6B4C5C"},
  {code:"NCS S 5020-B",name:"Djup dempet blå",hex:"#4C4C80"},{code:"NCS S 5020-B30G",name:"Djup dempet blågrøn",hex:"#4C616B"},
  {code:"NCS S 5020-G",name:"Djup dempet grøn",hex:"#4C804C"},{code:"NCS S 5020-G30Y",name:"Djup dempet grøngul",hex:"#5C804C"},
  // S 6020 — veldig mørk
  {code:"NCS S 6020-Y",name:"Veldig mørk gul",hex:"#666633"},{code:"NCS S 6020-R",name:"Veldig mørk raud",hex:"#663333"},
  {code:"NCS S 6020-B",name:"Veldig mørk blå",hex:"#333366"},{code:"NCS S 6020-G",name:"Veldig mørk grøn",hex:"#336633"},];


/* ── CIEDE2000 fargematte ─────────────────────────────── */
function hexRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}
function linC(v) { v/=255; return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055,2.4); }
function lumC(rgb) { return .2126*linC(rgb[0]) + .7152*linC(rgb[1]) + .0722*linC(rgb[2]); }
function contrastRatio(hA, hB) {
  var lA=lumC(hexRgb(hA)), lB=lumC(hexRgb(hB));
  var h=Math.max(lA,lB), l=Math.min(lA,lB);
  return (h+.05)/(l+.05);
}
function rgbToLab(r,g,b) {
  // sRGB → linear
  r=linC(r); g=linC(g); b=linC(b);
  // linear → XYZ (D65)
  var X=r*.4124564+g*.3575761+b*.1804375;
  var Y=r*.2126729+g*.7151522+b*.0721750;
  var Z=r*.0193339+g*.1191920+b*.9503041;
  // XYZ → Lab
  function f(t){return t>.008856?Math.pow(t,1/3):7.787*t+16/116;}
  var fx=f(X/.95047), fy=f(Y/1.0), fz=f(Z/1.08883);
  return [116*fy-16, 500*(fx-fy), 200*(fy-fz)];
}
function deltaE(hex1, hex2) {
  var rgb1=hexRgb(hex1), rgb2=hexRgb(hex2);
  var lab1=rgbToLab(rgb1[0],rgb1[1],rgb1[2]);
  var lab2=rgbToLab(rgb2[0],rgb2[1],rgb2[2]);
  var L1=lab1[0],a1=lab1[1],b1=lab1[2];
  var L2=lab2[0],a2=lab2[1],b2=lab2[2];
  var C1=Math.sqrt(a1*a1+b1*b1), C2=Math.sqrt(a2*a2+b2*b2);
  var Cab=(C1+C2)/2;
  var Cab7=Math.pow(Cab,7);
  var G=.5*(1-Math.sqrt(Cab7/(Cab7+6103515625)));
  var a1p=a1*(1+G), a2p=a2*(1+G);
  var C1p=Math.sqrt(a1p*a1p+b1*b1), C2p=Math.sqrt(a2p*a2p+b2*b2);
  function hprime(ap,b){if(ap===0&&b===0)return 0;var h=Math.atan2(b,ap)*180/Math.PI;return h<0?h+360:h;}
  var h1p=hprime(a1p,b1), h2p=hprime(a2p,b2);
  var dLp=L2-L1, dCp=C2p-C1p;
  var dhp;
  if(C1p*C2p===0){dhp=0;}
  else if(Math.abs(h2p-h1p)<=180){dhp=h2p-h1p;}
  else if(h2p-h1p>180){dhp=h2p-h1p-360;}
  else{dhp=h2p-h1p+360;}
  var dHp=2*Math.sqrt(C1p*C2p)*Math.sin(dhp/2*Math.PI/180);
  var Lbar=(L1+L2)/2, Cbarp=(C1p+C2p)/2;
  var hbarp;
  if(C1p*C2p===0){hbarp=h1p+h2p;}
  else if(Math.abs(h1p-h2p)<=180){hbarp=(h1p+h2p)/2;}
  else if(h1p+h2p<360){hbarp=(h1p+h2p+360)/2;}
  else{hbarp=(h1p+h2p-360)/2;}
  var T=1-.17*Math.cos((hbarp-30)*Math.PI/180)+.24*Math.cos(2*hbarp*Math.PI/180)+.32*Math.cos((3*hbarp+6)*Math.PI/180)-.20*Math.cos((4*hbarp-63)*Math.PI/180);
  var SL=1+.015*Math.pow(Lbar-50,2)/Math.sqrt(20+Math.pow(Lbar-50,2));
  var SC=1+.045*Cbarp, SH=1+.015*Cbarp*T;
  var Cbarp7=Math.pow(Cbarp,7);
  var RC=2*Math.sqrt(Cbarp7/(Cbarp7+6103515625));
  var dTheta=30*Math.exp(-Math.pow((hbarp-275)/25,2));
  var RT=-Math.sin(2*dTheta*Math.PI/180)*RC;
  return Math.sqrt(Math.pow(dLp/SL,2)+Math.pow(dCp/SC,2)+Math.pow(dHp/SH,2)+RT*(dCp/SC)*(dHp/SH));
}

function findNearestNCS(hex) {
  var best=NCS_COLORS[0], bestD=999;
  for(var i=0;i<NCS_COLORS.length;i++){var d=deltaE(hex,NCS_COLORS[i].hex);if(d<bestD){bestD=d;best=NCS_COLORS[i];}}
  return {color:best, de:bestD};
}
function findNearestRAL(hex) {
  var best=RAL_COLORS[0], bestD=999;
  for(var i=0;i<RAL_COLORS.length;i++){var d=deltaE(hex,RAL_COLORS[i].hex);if(d<bestD){bestD=d;best=RAL_COLORS[i];}}
  return {color:best, de:bestD};
}

function hexToHsl(hex) {
  var r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  var max=Math.max(r,g,b),min=Math.min(r,g,b),h=0,s=0,l=(max+min)/2;
  if(max!==min){var d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);
    if(max===r)h=((g-b)/d+(g<b?6:0))/6;else if(max===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}
  return[Math.round(h*360),Math.round(s*100),Math.round(l*100)];
}
function hslToHex(h,s,l) {
  s/=100;l/=100;var a=s*Math.min(l,1-l);
  function f(n){var k=(n+h/30)%12;return l-a*Math.max(Math.min(k-3,9-k,1),-1);}
  var r=Math.round(f(0)*255),g=Math.round(f(8)*255),b=Math.round(f(4)*255);
  return"#"+r.toString(16).padStart(2,"0")+g.toString(16).padStart(2,"0")+b.toString(16).padStart(2,"0");
}

/* ── Harmoniar ────────────────────────────────────────────── */
var HARMS = [
  {nm:"Komplement\u00E6r",fn:function(h){return[(h+180)%360];}},
  {nm:"Splittkomplement\u00E6r",fn:function(h){return[(h+150)%360,(h+210)%360];}},
  {nm:"Triade",fn:function(h){return[(h+120)%360,(h+240)%360];}},
  {nm:"Analogt",fn:function(h){return[(h+30)%360,(h+330)%360];}},
];

/* ── Utvendig profilar ────────────────────────────────────── */
var EXT_PROF = [
  {id:"e01",s:"mo",n:"Dobbelfals 60\u00B0",o:"l",d:["19x098","19x123","19x148","22x148"]},
  {id:"e02",s:"bh",n:"Dobbelfals tett",o:"b",d:["19x098","19x123","19x148"]},
  {id:"e03",s:"bh",n:"Dobbelfals rett",o:"b",d:["19x098","19x123","19x148"]},
  {id:"e04",s:"mo",n:"Vestlandspanel",o:"l",d:["19x120","19x145"]},
  {id:"e05",s:"mo",n:"Rektangul\u00E6r",o:"s",d:["19x098","19x123","19x148","21x120","22x098","22x148"]},
  {id:"e06",s:"bh",n:"Enkelfals",o:"l",d:["19x123","19x148"]},
  {id:"e07",s:"mo",n:"Lektekledning",o:"b",d:["22x048","22x073"]},
  {id:"e08",s:"mo",n:"Rhombus",o:"b",d:["19x068","19x073"]},
  {id:"e09",s:"bh",n:"Sveitser",o:"s",d:["22x120","22x145"]},
  {id:"e10",s:"bh",n:"Krager\u00F8",o:"s",d:["22x120"]},
  {id:"e11",s:"bh",n:"Barokk",o:"s",d:["19x120"]},
  {id:"e12",s:"bh",n:"Rustikk",o:"s",d:["21x120"]},
  {id:"e13",s:"mo",n:"Empire",o:"s",d:["19x120"]},
  {id:"e14",s:"mr",n:"Rektangul\u00E6r (Royal)",o:"s",d:["19x098","19x123","19x148","22x123"]},
  {id:"e15",s:"mr",n:"Dobbelfals (Royal)",o:"b",d:["19x098","19x123","19x148"]},
  {id:"e16",s:"mr",n:"Concise Collection",o:"b",d:["19x123"]},
];
var EXT_TREATS = [
  {id:"dekkbeis",nm:"Dekkbeis",col:true},{id:"beis",nm:"Beis",col:true},
  {id:"maling",nm:"Maling",col:true},{id:"ubehandla",nm:"Ubehandla",col:false,fix:"#B0A08A"},
  {id:"tjaere",nm:"Tj\u00E6rebehandla",col:false,fix:"#2C2418"},
  {id:"jernvitriol",nm:"Jernvitriol",col:false,fix:"#8A8878"},
  {id:"royal",nm:"Royalimpregnert",col:false,fix:"#8B7355"},
];
var SUPPLIERS = [{id:"bh",nm:"Bergene Holm",col:"#1B6B4A"},{id:"mo",nm:"Moelven",col:"#2563EB"},{id:"mr",nm:"M\u00F8reRoyal",col:"#9333EA"}];
var SOKKEL=["Betong","Betong (malt)","Naturstein","Tegl","Puss"];
var TAK=["Betongstein","Tegltakstein","St\u00E5lplater","Skifer","Torv/sed","Kopar","Sink","Membran"];
var BESLAG=["Aluminium","St\u00E5l lakkert","Sink","Kopar","Sort","Kvit"];

/* ── Innvendig data ─────────────────────────────────────── */
var INT_VEGG=[
  {id:"iv01",nm:"Glatt panel (not og fj\u00F8r)",d:["12x098","12x120","14x120","14x145"]},
  {id:"iv02",nm:"Staffpanel",d:["12x098","12x120","14x120"]},
  {id:"iv03",nm:"Perlestaff",d:["12x098","12x120"]},
  {id:"iv04",nm:"Vestlandspanel",d:["12x120","14x120"]},
  {id:"iv05",nm:"Bred panel",d:["14x145","14x170"]},
  {id:"iv06",nm:"Gipsplate (malt)",d:["13mm"]},
  {id:"iv07",nm:"Gipsplate (tapetsert)",d:["13mm"]},
  {id:"iv08",nm:"Fliser (keramisk)",d:[]},
  {id:"iv09",nm:"Fliser (naturstein)",d:[]},
  {id:"iv10",nm:"Betong (eksponert)",d:[]},
  {id:"iv11",nm:"Mikrosement",d:[]},
];
var INT_TREATS=[
  {id:"malt_matt",nm:"Malt (matt)",col:true},{id:"malt_silke",nm:"Malt (silkematt)",col:true},
  {id:"beiset",nm:"Beiset / lasert",col:true},{id:"oljet",nm:"Oljet",col:false,fix:"#C8B898"},
  {id:"kvitoljet",nm:"Kvitoljet",col:false,fix:"#E8DFD0"},{id:"ubehandla",nm:"Ubehandla",col:false,fix:"#C9B898"},
];
var INT_HIML=["Glatt panel","Staffpanel","Gips (malt)","Systemhimling","Eksponert betong","Eksponert trekonstruksjon"];
var INT_GOLV=["Parkett eik","Parkett ask","Parkett bj\u00F8rk","Bord (furu)","Bord (eik)","Laminat","Vinyl/LVT","Linoleum","Fliser","Polert betong","Teppe"];
var INT_LIST=["Fotlist","Taklist","Vindaugslist","D\u00F8rlist"];
var INT_DOR=["Glatt (malt)","Fyllingsd\u00F8r","Glasd\u00F8r","Skyved\u00F8r","Eikefinert"];

/* ── UI ───────────────────────────────────────────────────── */
function Chip(props){var a=props.active;return <button onClick={props.onClick} style={{padding:"7px 12px",borderRadius:6,border:a?"2px solid #1B4332":"1.5px solid #D6DAD0",background:a?"#1B433210":"#FFF",color:a?"#1B4332":"#3D5A47",fontSize:16,fontWeight:a?700:500,cursor:"pointer",textAlign:"left"}}>{props.children}</button>;}
function Lbl(props){return <div style={{fontSize:17,fontWeight:600,color:"#7A8F80",marginBottom:4,marginTop:props.mt||14}}>{props.children}</div>;}
function Sec(props){return <div style={{fontSize:16,fontWeight:800,color:"#1B4332",marginTop:props.mt||24,marginBottom:4}}>{props.children}</div>;}
function Dot(props){return <div onClick={props.onClick} style={{width:props.sz||26,height:props.sz||26,borderRadius:5,background:props.hex,border:props.on?"3px solid #1B4332":"1px solid rgba(0,0,0,0.1)",cursor:"pointer",flexShrink:0}} />;}

function NcsPick(props){
  var popular = NCS_COLORS.filter(function(c){return c.code.indexOf("0500-N")>=0||c.code.indexOf("1000-N")>=0||c.code.indexOf("2000-N")>=0||c.code.indexOf("3000-N")>=0||c.code.indexOf("4000-N")>=0||c.code.indexOf("5000-N")>=0||c.code.indexOf("7000-N")>=0||c.code.indexOf("9000-N")>=0||c.code.indexOf("1030-Y")>=0||c.code.indexOf("1030-R")>=0||c.code.indexOf("1030-B")>=0||c.code.indexOf("1030-G")>=0||c.code.indexOf("2040")>=0||c.code.indexOf("4030")>=0||c.code.indexOf("5020")>=0||c.code.indexOf("6020")>=0;});
  return(
    <div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {popular.map(function(c){return <Dot key={c.code} hex={c.hex} on={props.val===c.code} onClick={function(){props.pick(c.code,c.hex);}} />;})}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
        <input type="color" value={props.hex||"#C9C4B5"} onChange={function(e){props.pick("",e.target.value);}} style={{width:26,height:26,borderRadius:5,border:"2px solid #D6DAD0",cursor:"pointer",padding:0}} />
        <input value={props.val||props.hex||""} onChange={function(e){props.pick(e.target.value,"");}} placeholder="NCS-kode" style={{padding:"4px 8px",borderRadius:5,border:"1.5px solid #D6DAD0",fontSize:17,width:110,outline:"none"}} />
      </div>
    </div>
  );
}

function ColorInfo(props) {
  var hex = props.hex;
  if (!hex) return null;
  var ncs = findNearestNCS(hex);
  var ral = findNearestRAL(hex);
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
      <div style={{width:36,height:36,borderRadius:6,background:hex,border:"1px solid rgba(0,0,0,0.1)"}} />
      <div>
        <div style={{fontSize:17,fontWeight:700}}>NCS: {ncs.color.code.replace("NCS ","")} (\u0394E {ncs.de.toFixed(1)})</div>
        <div style={{fontSize:17,color:"#7A8F80"}}>RAL: {ral.color.code} {ral.color.name} (\u0394E {ral.de.toFixed(1)})</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function FargeModule({ userId, projects, activeOfficeId }) {
  var _tab=useState("oversikt");var tab=_tab[0];var setTab=_tab[1];
  var _subs=useState([{id:1,nm:"Hus A"}]);var subs=_subs[0];var setSubs=_subs[1];
  var _aSub=useState(1);var aSub=_aSub[0];var setASub=_aSub[1];

  /* Oversikt */
  var _base=useState("#1B4332");var base=_base[0];var setBase=_base[1];
  var _picked=useState([]);var picked=_picked[0];var setPicked=_picked[1];
  var _imgSrc=useState(null);var imgSrc=_imgSrc[0];var setImgSrc=_imgSrc[1];
  var _imgCol=useState([]);var imgCol=_imgCol[0];var setImgCol=_imgCol[1];
  var imgRef=useRef(null);

  /* Utvendig */
  var _eO=useState("");var eO=_eO[0];var setEO=_eO[1];
  var _eP=useState(null);var eP=_eP[0];var setEP=_eP[1];
  var _eD=useState("");var eD=_eD[0];var setED=_eD[1];
  var _eT=useState("");var eT=_eT[0];var setET=_eT[1];
  var _eN=useState("");var eN=_eN[0];var setEN=_eN[1];
  var _eH=useState("#C9C4B5");var eH=_eH[0];var setEH=_eH[1];
  var _listH=useState("#F0EFEA");var listH=_listH[0];var setListH=_listH[1];
  var _besH=useState("#3C3C3C");var besH=_besH[0];var setBesH=_besH[1];
  var _sokH=useState("#999999");var sokH=_sokH[0];var setSokH=_sokH[1];
  var _takH=useState("#4A4742");var takH=_takH[0];var setTakH=_takH[1];

  /* Innvendig */
  var _iV=useState(null);var iV=_iV[0];var setIV=_iV[1];
  var _iVD=useState("");var iVD=_iVD[0];var setIVD=_iVD[1];
  var _iVT=useState("");var iVT=_iVT[0];var setIVT=_iVT[1];
  var _iVN=useState("");var iVN=_iVN[0];var setIVN=_iVN[1];
  var _iVH=useState("#F0EFEA");var iVH=_iVH[0];var setIVH=_iVH[1];
  var _iHH=useState("#FFFFFF");var iHH=_iHH[0];var setIHH=_iHH[1];
  var _iGH=useState("#B8A07A");var iGH=_iGH[0];var setIGH=_iGH[1];
  var _iLH=useState("#F0EFEA");var iLH=_iLH[0];var setILH=_iLH[1];
  var _iDH=useState("#F0EFEA");var iDH=_iDH[0];var setIDH=_iDH[1];

  var eTO=EXT_TREATS.find(function(t){return t.id===eT;});
  var eSH=eTO&&eTO.fix?eTO.fix:eH;
  var eF=EXT_PROF.filter(function(p){if(eO&&p.o!==eO&&p.o!=="b")return false;return true;});
  var iVTO=INT_TREATS.find(function(t){return t.id===iVT;});
  var iVSH=iVTO&&iVTO.fix?iVTO.fix:iVH;

  var harms=[];var bHsl=hexToHsl(base);
  HARMS.forEach(function(hr){var pal=[base];var hues=hr.fn(bHsl[0]);hues.forEach(function(newH){pal.push(hslToHex(newH,bHsl[1],bHsl[2]));});harms.push({nm:hr.nm,pal:pal});});

  function togglePick(hex){setPicked(function(p){return p.indexOf(hex)>=0?p.filter(function(c){return c!==hex;}):p.concat([hex]);});}

  function onImg(e){
    var file=e.target.files[0];if(!file)return;
    var reader=new FileReader();
    reader.onload=function(ev){
      var src=ev.target.result;setImgSrc(src);
      var canvas=document.createElement("canvas");var ctx=canvas.getContext("2d");
      var im=new Image();im.onload=function(){
        var w=Math.min(im.width,150);var h=Math.round((im.height/im.width)*w);
        canvas.width=w;canvas.height=h;ctx.drawImage(im,0,0,w,h);
        var data=ctx.getImageData(0,0,w,h).data;var px=[];
        for(var i=0;i<data.length;i+=16)px.push([data[i],data[i+1],data[i+2]]);
        var bk=[px];while(bk.length<6){
          var wi=0,wr=0;
          for(var bi=0;bi<bk.length;bi++)for(var ch=0;ch<3;ch++){
            var vs=bk[bi].map(function(p){return p[ch];});var rng=Math.max.apply(null,vs)-Math.min.apply(null,vs);
            if(rng>wr){wr=rng;wi=bi;}
          }
          var bucket=bk[wi];var mc=0,mr=0;
          for(var c2=0;c2<3;c2++){var v2=bucket.map(function(p){return p[c2];});var r2=Math.max.apply(null,v2)-Math.min.apply(null,v2);if(r2>mr){mr=r2;mc=c2;}}
          bucket.sort(function(a,b){return a[mc]-b[mc];});var mid=Math.floor(bucket.length/2);
          bk.splice(wi,1,bucket.slice(0,mid),bucket.slice(mid));
        }
        setImgCol(bk.map(function(b){var av=[0,0,0];b.forEach(function(p){av[0]+=p[0];av[1]+=p[1];av[2]+=p[2];});return"#"+Math.round(av[0]/b.length).toString(16).padStart(2,"0")+Math.round(av[1]/b.length).toString(16).padStart(2,"0")+Math.round(av[2]/b.length).toString(16).padStart(2,"0");}));
      };im.src=src;
    };reader.readAsDataURL(file);
  }

  function TopTab(key,label){var a=tab===key;return <button onClick={function(){setTab(key);}} style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid "+(a?"rgba(255,255,255,0.55)":"transparent"),background:a?"rgba(255,255,255,0.18)":"transparent",color:a?"#fff":"rgba(255,255,255,0.65)",fontSize:17,cursor:"pointer",fontWeight:a?700:500}}>{label}</button>;}

  function SubBar(){
    var _ns=useState(false);var ns=_ns[0];var setNs=_ns[1];
    var _nn=useState("");var nn=_nn[0];var setNn=_nn[1];
    return(
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#FFF",borderBottom:"1px solid #D6DAD0",flexShrink:0,overflowX:"auto"}}>
        {subs.map(function(sp){var a=aSub===sp.id;return <button key={sp.id} onClick={function(){setASub(sp.id);}} style={{padding:"5px 12px",borderRadius:6,border:a?"2px solid #1B4332":"1.5px solid #D6DAD0",fontSize:16,fontWeight:a?700:500,cursor:"pointer"}}>{sp.nm}</button>;})}
        {ns?<input value={nn} onChange={function(e){setNn(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"&&nn.trim()){var id=Date.now();setSubs(function(p){return p.concat([{id:id,nm:nn.trim()}]);});setASub(id);setNn("");setNs(false);}}} placeholder="Namn..." autoFocus style={{padding:"4px 8px",borderRadius:5,border:"1.5px solid #1B4332",fontSize:17,width:80,outline:"none"}} />
        :<button onClick={function(){setNs(true);}} style={{padding:"5px 10px",borderRadius:6,border:"1.5px dashed #D6DAD0",background:"transparent",fontSize:17,color:"#7A8F80",cursor:"pointer"}}>+</button>}
      </div>
    );
  }

  return(
    <div style={{display:"flex",flex:1,flexDirection:"column",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"0 16px",height:50,flexShrink:0,background:"var(--brand)",borderBottom:"1px solid rgba(255,255,255,.1)"}}>
        <span style={{fontSize:17,fontWeight:800,color:"#fff",marginRight:8}}>Farge</span>
        {TopTab("oversikt","Oversikt")}
        {TopTab("utvendig","Utvendig")}
        {TopTab("innvendig","Innvendig")}
        {picked.length>0&&<span style={{fontSize:16,color:"rgba(255,255,255,0.5)",marginLeft:8}}>{picked.length} valde</span>}
      </div>

      <SubBar />

      {/* OVERSIKT */}
      {tab==="oversikt"&&(
        <div style={{flex:1,overflow:"auto",padding:16}}><div style={{maxWidth:700}}>
          <Sec mt={0}>Fargeveljar</Sec>
          <div style={{fontSize:16,color:"#7A8F80",marginBottom:12}}>Vel basisfarge. Klikk fargar for \u00E5 velje dei til utvendig/innvendig. CIEDE2000 (\u0394E) for n\u00F8yaktig NCS/RAL-konvertering.</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <input type="color" value={base} onChange={function(e){setBase(e.target.value);}} style={{width:48,height:48,borderRadius:8,border:"2px solid #D6DAD0",cursor:"pointer",padding:0}} />
            <div>
              <div style={{fontSize:16,fontWeight:700}}>{base.toUpperCase()}</div>
              <ColorInfo hex={base} />
            </div>
          </div>

          {harms.map(function(hr){
            return(
              <div key={hr.nm} style={{marginBottom:10,background:"#FFF",borderRadius:8,border:"1px solid #D6DAD0",padding:"10px 14px"}}>
                <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>{hr.nm}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {hr.pal.map(function(hex,i){
                    var nM=findNearestNCS(hex);var rM=findNearestRAL(hex);var ip=picked.indexOf(hex)>=0;var lm=lumC(hexRgb(hex));
                    return(
                      <div key={i} onClick={function(){togglePick(hex);}} style={{cursor:"pointer",textAlign:"center"}}>
                        <div style={{width:56,height:56,borderRadius:6,background:hex,border:ip?"3px solid #1B4332":"1px solid rgba(0,0,0,0.1)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {ip&&<span style={{fontSize:18,color:lm>0.4?"#1A2E23":"#FFF"}}>\u2713</span>}
                        </div>
                        <div style={{fontSize:16,fontWeight:700,marginTop:3}}>{hex.toUpperCase()}</div>
                        <div style={{fontSize:17,color:"#7A8F80"}}>{nM.color.code.replace("NCS ","")}</div>
                        <div style={{fontSize:17,color:"#7A8F80"}}>{rM.color.code}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {picked.length>0&&(
            <div style={{marginTop:16,padding:"12px 16px",background:"#FFF",borderRadius:8,border:"2px solid #1B4332"}}>
              <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Valde fargar ({picked.length})</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                {picked.map(function(hex){
                  var nM=findNearestNCS(hex);var rM=findNearestRAL(hex);
                  return(
                    <div key={hex} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px 4px 4px",borderRadius:6,background:"#F4F5F0",border:"1px solid #D6DAD0"}}>
                      <div style={{width:20,height:20,borderRadius:4,background:hex}} />
                      <div><div style={{fontSize:17,fontWeight:700}}>{nM.color.code.replace("NCS ","")}</div><div style={{fontSize:16,color:"#7A8F80"}}>{rM.color.code}</div></div>
                      <button onClick={function(){togglePick(hex);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:17,color:"#7A8F80"}}>x</button>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={function(){if(picked[0])setEH(picked[0]);if(picked[1])setListH(picked[1]);setTab("utvendig");}} style={{padding:"8px 16px",borderRadius:6,border:"none",background:"#1B4332",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer"}}>Bruk i Utvendig \u2192</button>
                <button onClick={function(){if(picked[0])setIVH(picked[0]);if(picked[1])setILH(picked[1]);setTab("innvendig");}} style={{padding:"8px 16px",borderRadius:6,border:"none",background:"#1B4332",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer"}}>Bruk i Innvendig \u2192</button>
              </div>
            </div>
          )}

          <Sec>Hent fargar fr\u00E5 bilete</Sec>
          <button onClick={function(){imgRef.current.click();}} style={{padding:"10px 16px",borderRadius:6,border:"1.5px solid #D6DAD0",background:"#FFF",fontSize:16,cursor:"pointer",marginBottom:10}}>Last opp bilete</button>
          <input ref={imgRef} type="file" accept="image/*" onChange={onImg} style={{display:"none"}} />
          {imgSrc&&<img src={imgSrc} alt="" style={{maxWidth:280,borderRadius:6,border:"1px solid #D6DAD0",display:"block",marginBottom:8,objectFit:"cover"}} />}
          {imgCol.length>0&&(
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {imgCol.map(function(c,i){
                var nM=findNearestNCS(c);var rM=findNearestRAL(c);var ip=picked.indexOf(c)>=0;
                return(
                  <div key={i} onClick={function(){togglePick(c);}} style={{cursor:"pointer",textAlign:"center"}}>
                    <div style={{width:48,height:48,borderRadius:6,background:c,border:ip?"3px solid #1B4332":"1px solid rgba(0,0,0,0.1)"}} />
                    <div style={{fontSize:17,fontWeight:700,marginTop:2}}>{nM.color.code.replace("NCS ","")}</div>
                    <div style={{fontSize:17,color:"#7A8F80"}}>{rM.color.code}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div></div>
      )}

      {/* UTVENDIG */}
      {tab==="utvendig"&&(
        <div style={{flex:1,overflow:"auto",padding:16}}><div style={{maxWidth:960}}>
          <Sec mt={0}>Hovudkledning</Sec>
          <Lbl mt={4}>ORIENTERING</Lbl>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            <Chip active={eO==="s"} onClick={function(){setEO("s");setEP(null);}}>St\u00E5ande</Chip>
            <Chip active={eO==="l"} onClick={function(){setEO("l");setEP(null);}}>Liggjande</Chip>
            <Chip active={eO===""} onClick={function(){setEO("");setEP(null);}}>Alle</Chip>
          </div>
          <Lbl mt={4}>PROFIL ({eF.length})</Lbl>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {eF.map(function(p){var a=eP&&eP.id===p.id;return <Chip key={p.id} active={a} onClick={function(){setEP(p);setED(p.d[0]);setET("");}}>{p.n} <span style={{fontSize:17,color:"#7A8F80"}}>({p.d[0]})</span></Chip>;})}
          </div>
          {eP&&eP.d.length>1&&<div><Lbl>DIMENSJON</Lbl><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{eP.d.map(function(dd){return <Chip key={dd} active={eD===dd} onClick={function(){setED(dd);}}>{dd}</Chip>;})}</div></div>}
          {eP&&<div><Lbl>BEHANDLING</Lbl><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{EXT_TREATS.map(function(t){return <Chip key={t.id} active={eT===t.id} onClick={function(){setET(t.id);}}>{t.nm}</Chip>;})}</div></div>}
          {eT&&eTO&&eTO.col&&<div><Lbl>FARGE</Lbl><NcsPick val={eN} hex={eH} pick={function(c,h){setEN(c);if(h)setEH(h);}} /></div>}
          {eT&&<ColorInfo hex={eSH} />}
          <Sec>Listverk</Sec>
          <div style={{display:"flex",alignItems:"center",gap:6}}><input type="color" value={listH} onChange={function(e){setListH(e.target.value);}} style={{width:26,height:26,borderRadius:5,border:"2px solid #D6DAD0",cursor:"pointer",padding:0}} />{["#F0EFEA","#DDD9D0","#252422"].map(function(c){return <Dot key={c} hex={c} on={listH===c} onClick={function(){setListH(c);}} sz={22} />;})}</div>
          <ColorInfo hex={listH} />
          <Sec>Beslag</Sec>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>{BESLAG.map(function(b){return <Chip key={b} active={false} onClick={function(){}}>{b}</Chip>;})}</div>
          <input type="color" value={besH} onChange={function(e){setBesH(e.target.value);}} style={{width:26,height:26,borderRadius:5,border:"2px solid #D6DAD0",cursor:"pointer",padding:0}} />
          <Sec>Sokkel</Sec>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>{SOKKEL.map(function(s){return <Chip key={s} active={false} onClick={function(){}}>{s}</Chip>;})}</div>
          <input type="color" value={sokH} onChange={function(e){setSokH(e.target.value);}} style={{width:26,height:26,borderRadius:5,border:"2px solid #D6DAD0",cursor:"pointer",padding:0}} />
          <Sec>Taktekking</Sec>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>{TAK.map(function(t){return <Chip key={t} active={false} onClick={function(){}}>{t}</Chip>;})}</div>
          <input type="color" value={takH} onChange={function(e){setTakH(e.target.value);}} style={{width:26,height:26,borderRadius:5,border:"2px solid #D6DAD0",cursor:"pointer",padding:0,marginBottom:20}} />
        </div></div>
      )}

      {/* INNVENDIG */}
      {tab==="innvendig"&&(
        <div style={{flex:1,overflow:"auto",padding:16}}><div style={{maxWidth:960}}>
          <Sec mt={0}>Vegg</Sec>
          <Lbl mt={4}>MATERIALE</Lbl>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{INT_VEGG.map(function(v){var a=iV&&iV.id===v.id;return <Chip key={v.id} active={a} onClick={function(){setIV(v);setIVD(v.d[0]||"");setIVT("");}}>{v.nm}</Chip>;})}</div>
          {iV&&iV.d.length>1&&<div><Lbl>DIMENSJON</Lbl><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{iV.d.map(function(dd){return <Chip key={dd} active={iVD===dd} onClick={function(){setIVD(dd);}}>{dd}</Chip>;})}</div></div>}
          {iV&&<div><Lbl>BEHANDLING</Lbl><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{INT_TREATS.map(function(t){return <Chip key={t.id} active={iVT===t.id} onClick={function(){setIVT(t.id);}}>{t.nm}</Chip>;})}</div></div>}
          {iVT&&iVTO&&iVTO.col&&<div><Lbl>FARGE</Lbl><NcsPick val={iVN} hex={iVH} pick={function(c,h){setIVN(c);if(h)setIVH(h);}} /></div>}
          {iVT&&<ColorInfo hex={iVSH} />}
          <Sec>Himling</Sec>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>{INT_HIML.map(function(h){return <Chip key={h} active={false} onClick={function(){}}>{h}</Chip>;})}</div>
          <input type="color" value={iHH} onChange={function(e){setIHH(e.target.value);}} style={{width:26,height:26,borderRadius:5,border:"2px solid #D6DAD0",cursor:"pointer",padding:0}} />
          <ColorInfo hex={iHH} />
          <Sec>Golv</Sec>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>{INT_GOLV.map(function(g){return <Chip key={g} active={false} onClick={function(){}}>{g}</Chip>;})}</div>
          <input type="color" value={iGH} onChange={function(e){setIGH(e.target.value);}} style={{width:26,height:26,borderRadius:5,border:"2px solid #D6DAD0",cursor:"pointer",padding:0}} />
          <Sec>Listverk</Sec>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>{INT_LIST.map(function(l){return <Chip key={l} active={false} onClick={function(){}}>{l}</Chip>;})}</div>
          <input type="color" value={iLH} onChange={function(e){setILH(e.target.value);}} style={{width:26,height:26,borderRadius:5,border:"2px solid #D6DAD0",cursor:"pointer",padding:0}} />
          <Sec>D\u00F8rer</Sec>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>{INT_DOR.map(function(d){return <Chip key={d} active={false} onClick={function(){}}>{d}</Chip>;})}</div>
          <input type="color" value={iDH} onChange={function(e){setIDH(e.target.value);}} style={{width:26,height:26,borderRadius:5,border:"2px solid #D6DAD0",cursor:"pointer",padding:0,marginBottom:12}} />
          <div style={{marginTop:16,padding:"14px 18px",background:"#FFF",borderRadius:10,border:"1px solid #D6DAD0",marginBottom:20}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Innvendig fargesamanstilling</div>
            <div style={{display:"flex",borderRadius:8,overflow:"hidden",height:50}}>
              <div style={{flex:1,background:iVSH}} /><div style={{flex:1,background:iHH}} />
              <div style={{flex:1,background:iGH}} /><div style={{flex:0.3,background:iLH}} />
              <div style={{flex:0.3,background:iDH}} />
            </div>
            <div style={{display:"flex",fontSize:17,color:"#7A8F80",marginTop:4}}>
              <span style={{flex:1}}>Vegg</span><span style={{flex:1}}>Himling</span>
              <span style={{flex:1}}>Golv</span><span style={{flex:0.3}}>List</span>
              <span style={{flex:0.3}}>D\u00F8r</span>
            </div>
          </div>
        </div></div>
      )}

      <div style={{padding:"8px 16px",fontSize:16,color:"var(--text3)",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"space-between",flexShrink:0}}>
        <span>Fargemodul \u00B7 {RAL_COLORS.length} RAL + {NCS_COLORS.length} NCS \u00B7 CIEDE2000</span>
        <span>{EXT_PROF.length} utv. profilar</span>
      </div>
    </div>
  );
}
