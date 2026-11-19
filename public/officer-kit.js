export const officerKit=(role,level=0)=>role==='swat'
  ?{grade:'Intervention',arm:'smg',reach:24,interval:1900,damage:11}
  :level>=2
    ?{grade:'Brigade',arm:'shotgun',reach:14,interval:2600,damage:12}
    :{grade:'Patrouille',arm:'pistol',reach:15,interval:2500,damage:7};
