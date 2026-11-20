// Accessible kerbside stops on the connected streets of Les Vieilles Mailles.
// Angles follow the underlying road so workshop collections face along the street.
const place=(id,name,x,y,angle)=>({id,name,x,y,angle});
export const careerPlaces={
  market:place('market','Halles des Tisserands',-5.6,-280.8,-.708),
  garage:place('garage','Garage des Deux Bornes',-75.8,-156.7,-.901),
  station:place('station','Arrêt des Navettes',47,-97.4,-2.272),
  quay:place('quay','Cour des Teinturiers',154.5,-165.3,.113),
  police:place('police','Commissariat des Lanternes',13.4,-454.1,.692)
};
export const careerRadius=14;
export const careerGarage={price:270,repair:30,type:'compact',licensePrice:200,memberRepair:15,rentPerContract:12,rentCap:60};
const stop=(place,label)=>({place,label,vehicle:true});
export const careerContracts={
  delivery:{id:'delivery',title:'La tournée des Halles',description:'Charge les ballots aux Halles et livre-les à l’atelier dans le même véhicule.',reward:85,seconds:300,difficulty:'Facile',stages:[
    stop('market','Charger les ballots'),stop('quay','Livrer les ballots')]},
  taxi:{id:'taxi',title:'La dernière navette',description:'Prends un client à l’arrêt et dépose-le au commissariat. Il lui faut un véhicule fermé.',reward:115,seconds:300,difficulty:'Intermédiaire',stages:[
    stop('station','Prendre le client'),stop('police','Déposer le client')]},
  relay:{id:'relay',title:'Les courriers en tandem',description:'En équipe, chargez aux Halles, faites viser le bordereau au garage et livrez à la cour. Le même coéquipier doit occuper le siège à chaque arrêt.',reward:180,seconds:300,difficulty:'En duo',cooperative:true,stages:[
    stop('market','Charger en équipe'),stop('garage','Faire viser le bordereau'),stop('quay','Remettre les ballots à deux')]},
  race:{id:'race',title:'Le tour des ateliers',description:'Passe les trois contrôles avec le même véhicule avant la fin du chrono.',reward:145,seconds:125,difficulty:'Sportif',stages:[
    stop('garage','Passer le départ'),stop('quay','Passer le contrôle'),stop('market','Franchir l’arrivée')]}
};
