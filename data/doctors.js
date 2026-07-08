export const DOCTORS = [
  {id:1, name:'Dr. Priya Nair', specialty:'General Medicine', facilityId:1, ratingSum:42, ratingCount:10, experience:9, fee:150, available:true, degree:'MBBS, MD (General Medicine)', photo:'https://randomuser.me/api/portraits/women/68.jpg'},
  {id:2, name:'Dr. Arvind Rao', specialty:'Cardiology', facilityId:2, ratingSum:38, ratingCount:9, experience:14, fee:350, available:true, degree:'MBBS, DM (Cardiology)', photo:'https://randomuser.me/api/portraits/men/32.jpg'},
  {id:3, name:'Dr. Farah Sheikh', specialty:'Pediatrics', facilityId:3, ratingSum:47, ratingCount:10, experience:11, fee:200, available:false, degree:'MBBS, MD (Paediatrics)', photo:'https://randomuser.me/api/portraits/women/44.jpg'},
  {id:4, name:'Dr. Sanjay Gupta', specialty:'Diabetes & Endocrinology', facilityId:1, ratingSum:35, ratingCount:8, experience:16, fee:300, available:true, degree:'MBBS, DM (Endocrinology)', photo:'https://randomuser.me/api/portraits/men/54.jpg'},
  {id:5, name:'Dr. Meera Joshi', specialty:'Gynaecology', facilityId:4, ratingSum:44, ratingCount:10, experience:12, fee:250, available:true, degree:'MBBS, MS (OBG)', photo:'https://randomuser.me/api/portraits/women/22.jpg'},
  {id:6, name:'Dr. Alok Tiwari', specialty:'Orthopaedics', facilityId:2, ratingSum:31, ratingCount:7, experience:7, fee:220, available:false, degree:'MBBS, MS (Ortho)', photo:'https://randomuser.me/api/portraits/men/76.jpg'},
];

export function getDoctor(id) {
  return DOCTORS.find(d => d.id === id);
}

export function doctorAvgRating(d) {
  return d.ratingCount ? d.ratingSum / d.ratingCount : 0;
}

export function starString(avg) {
  const full = Math.round(avg);
  let s = '';
  for(let i=1; i<=5; i++) s += i<=full ? '★' : '☆';
  return s;
}
