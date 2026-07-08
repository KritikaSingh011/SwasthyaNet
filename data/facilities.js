export const FACILITIES = [
  {id:1, name:"PHC Chinhat", type:"PHC", bedsTotal:10, bedsOcc:6, docSched:3, docPresent:3, footfall:82, lat:26.9017, lng:81.0566,
   tests:[{name:"Blood Sugar",available:true},{name:"X-Ray",available:false},{name:"ECG",available:true},{name:"Malaria RDT",available:true}]},
  {id:2, name:"CHC Mohanlalganj", type:"CHC", bedsTotal:30, bedsOcc:27, docSched:4, docPresent:2, footfall:140, lat:26.6812, lng:80.9962,
   tests:[{name:"Blood Sugar",available:true},{name:"X-Ray",available:true},{name:"Ultrasound",available:true},{name:"ECG",available:true}]},
  {id:3, name:"PHC Gosainganj", type:"PHC", bedsTotal:8, bedsOcc:3, docSched:2, docPresent:2, footfall:45, lat:26.7280, lng:81.2295,
   tests:[{name:"Blood Sugar",available:true},{name:"X-Ray",available:false},{name:"Malaria RDT",available:true}]},
  {id:4, name:"CHC Bakshi Ka Talab", type:"CHC", bedsTotal:25, bedsOcc:24, docSched:5, docPresent:3, footfall:168, lat:26.9500, lng:80.8340,
   tests:[{name:"Blood Sugar",available:true},{name:"X-Ray",available:true},{name:"Ultrasound",available:false},{name:"ECG",available:true}]},
  {id:5, name:"PHC Malihabad", type:"PHC", bedsTotal:10, bedsOcc:2, docSched:2, docPresent:0, footfall:30, lat:26.9187, lng:80.7106,
   tests:[{name:"Blood Sugar",available:false},{name:"X-Ray",available:false},{name:"Malaria RDT",available:true}]},
];

export function getFacility(id) {
  return FACILITIES.find(f => f.id == id);
}
