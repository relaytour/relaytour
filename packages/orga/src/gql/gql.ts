/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query MonScore($editionId: ID!) {\n    monScore(editionId: $editionId) {\n      points\n      tachesRealisees\n      tachesATemps\n      tachesCreees\n      fichesCreees\n      fichesModifiees\n    }\n    baremeScore {\n      tacheRealisee\n      bonusATemps\n      tacheCreee\n      ficheCreee\n      ficheModifiee\n    }\n  }\n": typeof types.MonScoreDocument,
    "\n  query MenuPerimetres {\n    moi {\n      id\n      affectations {\n        id\n        perimetre {\n          id\n          slug\n          nom\n        }\n      }\n    }\n  }\n": typeof types.MenuPerimetresDocument,
    "\n  query NombreNotificationsNonLues {\n    nombreNotificationsNonLues\n  }\n": typeof types.NombreNotificationsNonLuesDocument,
    "\n  query ListeNotifications {\n    notifications(limite: 40) {\n      id\n      type\n      message\n      lien\n      lue\n      creeLe\n    }\n  }\n": typeof types.ListeNotificationsDocument,
    "\n  mutation MarquerNotificationsLues($ids: [ID!]) {\n    marquerNotificationsLues(ids: $ids)\n  }\n": typeof types.MarquerNotificationsLuesDocument,
    "\n  query Fiche($slug: String!) {\n    moi {\n      id\n      estAdmin\n    }\n    fiche(slug: $slug) {\n      id\n      slug\n      titre\n      contenu\n      source\n      archive\n      modifieeLe\n      modifieePar\n      peutModifier\n      donneesPersonnelles\n      perimetre {\n        id\n        slug\n        nom\n        couleur\n      }\n    }\n  }\n": typeof types.FicheDocument,
    "\n  query VersionsFiche($slug: String!) {\n    fiche(slug: $slug) {\n      id\n      versionCouranteId\n      versions {\n        id\n        titre\n        contenu\n        source\n        resume\n        creeLe\n        auteur {\n          id\n          nom\n        }\n      }\n    }\n  }\n": typeof types.VersionsFicheDocument,
    "\n  query ListeFiches {\n    fiches {\n      id\n      slug\n      titre\n      modifieeLe\n      perimetre {\n        id\n        slug\n        nom\n        couleur\n      }\n    }\n    peutRedigerFichesCommunes\n  }\n": typeof types.ListeFichesDocument,
    "\n  mutation CreerFiche(\n    $slug: String!\n    $titre: String!\n    $contenu: String!\n    $perimetreId: ID\n  ) {\n    creerFiche(\n      slug: $slug\n      titre: $titre\n      contenu: $contenu\n      perimetreId: $perimetreId\n    ) {\n      id\n      slug\n    }\n  }\n": typeof types.CreerFicheDocument,
    "\n  mutation ModifierFiche(\n    $id: ID!\n    $titre: String!\n    $contenu: String!\n    $resume: String\n  ) {\n    modifierFiche(id: $id, titre: $titre, contenu: $contenu, resume: $resume) {\n      id\n      slug\n      titre\n      contenu\n      modifieeLe\n      modifieePar\n      source\n      donneesPersonnelles\n    }\n  }\n": typeof types.ModifierFicheDocument,
    "\n  mutation RestaurerVersionFiche($versionId: ID!) {\n    restaurerVersionFiche(versionId: $versionId) {\n      id\n      titre\n      contenu\n      modifieeLe\n      modifieePar\n      source\n    }\n  }\n": typeof types.RestaurerVersionFicheDocument,
    "\n  query Moi {\n    moi {\n      id\n      nom\n      email\n      estAdmin\n    }\n  }\n": typeof types.MoiDocument,
    "\n  query EditionCourante {\n    editionCourante {\n      id\n      annee\n      nom\n      debut\n      fin\n      statut\n    }\n  }\n": typeof types.EditionCouranteDocument,
    "\n  query Editions {\n    editions {\n      id\n      annee\n      nom\n      debut\n      fin\n      statut\n    }\n  }\n": typeof types.EditionsDocument,
    "\n  query Perimetres($inclureArchives: Boolean) {\n    perimetres(inclureArchives: $inclureArchives) {\n      id\n      slug\n      nom\n      type\n      couleur\n      ordre\n      archive\n    }\n  }\n": typeof types.PerimetresDocument,
    "\n  fragment TacheChamps on Tache {\n    id\n    titre\n    description\n    echeance\n    statut\n    enRetard\n    termineeLe\n    perimetre {\n      id\n      slug\n      nom\n      couleur\n    }\n    assignes {\n      id\n      nom\n    }\n    clotureePar {\n      id\n      nom\n    }\n    realiseePar {\n      id\n      nom\n    }\n    fiche {\n      id\n      slug\n      titre\n    }\n  }\n": typeof types.TacheChampsFragmentDoc,
    "\n  mutation CreerTache(\n    $perimetreId: ID!\n    $editionId: ID!\n    $titre: String!\n    $description: String\n    $echeance: Date\n    $ficheId: ID\n    $mAssigner: Boolean\n  ) {\n    creerTache(\n      perimetreId: $perimetreId\n      editionId: $editionId\n      titre: $titre\n      description: $description\n      echeance: $echeance\n      ficheId: $ficheId\n      mAssigner: $mAssigner\n    ) {\n      ...TacheChamps\n    }\n  }\n": typeof types.CreerTacheDocument,
    "\n  mutation ModifierTache(\n    $id: ID!\n    $titre: String!\n    $description: String\n    $echeance: Date\n    $ficheId: ID\n    $confirmer: Boolean\n  ) {\n    modifierTache(\n      id: $id\n      titre: $titre\n      description: $description\n      echeance: $echeance\n      ficheId: $ficheId\n      confirmer: $confirmer\n    ) {\n      ...TacheChamps\n    }\n  }\n": typeof types.ModifierTacheDocument,
    "\n  mutation ChangerStatutTache(\n    $id: ID!\n    $statut: StatutTache!\n    $realiseeParId: ID\n    $confirmer: Boolean\n  ) {\n    changerStatutTache(\n      id: $id\n      statut: $statut\n      realiseeParId: $realiseeParId\n      confirmer: $confirmer\n    ) {\n      ...TacheChamps\n    }\n  }\n": typeof types.ChangerStatutTacheDocument,
    "\n  mutation AssignerTache($id: ID!, $assigne: Boolean!, $personneId: ID) {\n    assignerTache(id: $id, assigne: $assigne, personneId: $personneId) {\n      ...TacheChamps\n    }\n  }\n": typeof types.AssignerTacheDocument,
    "\n  query PerimetreCibleFiche($slug: String!) {\n    perimetre(slug: $slug) {\n      id\n      nom\n      peutRedigerFiches\n    }\n  }\n": typeof types.PerimetreCibleFicheDocument,
    "\n  query DroitFichesCommunes {\n    peutRedigerFichesCommunes\n  }\n": typeof types.DroitFichesCommunesDocument,
    "\n  query MesTaches($editionId: ID!) {\n    moi {\n      id\n      affectations(editionId: $editionId) {\n        id\n        perimetre {\n          id\n          slug\n          nom\n          type\n          couleur\n          referents(editionId: $editionId) {\n            id\n            nom\n          }\n          avancement(editionId: $editionId) {\n            total\n            faites\n            abandonnees\n            enRetard\n            sansPersonne\n          }\n        }\n      }\n    }\n    mesTaches(editionId: $editionId) {\n      ...TacheChamps\n    }\n    tachesAPrendre(editionId: $editionId) {\n      ...TacheChamps\n    }\n  }\n": typeof types.MesTachesDocument,
    "\n  query PagePerimetre($slug: String!, $editionId: ID!) {\n    moi {\n      id\n    }\n    perimetre(slug: $slug) {\n      id\n      nom\n      type\n      couleur\n      peutModifier(editionId: $editionId)\n      referents(editionId: $editionId) {\n        id\n        nom\n      }\n      avancement(editionId: $editionId) {\n        total\n        aFaire\n        enCours\n        faites\n        abandonnees\n        enRetard\n        sansPersonne\n      }\n      taches(editionId: $editionId) {\n        ...TacheChamps\n      }\n      peutRedigerFiches\n      fiches {\n        id\n        slug\n        titre\n      }\n    }\n    fichesCommunes: fiches {\n      id\n      titre\n      perimetre {\n        id\n      }\n    }\n  }\n": typeof types.PagePerimetreDocument,
    "\n  query MesPreferencesNotification {\n    mesPreferencesNotification {\n      frequenceResume\n      mailModification\n      mailEcheance\n    }\n  }\n": typeof types.MesPreferencesNotificationDocument,
    "\n  mutation ModifierPreferencesNotification(\n    $frequenceResume: FrequenceResume!\n    $mailModification: Boolean!\n    $mailEcheance: Boolean!\n  ) {\n    modifierPreferencesNotification(\n      frequenceResume: $frequenceResume\n      mailModification: $mailModification\n      mailEcheance: $mailEcheance\n    ) {\n      frequenceResume\n      mailModification\n      mailEcheance\n    }\n  }\n": typeof types.ModifierPreferencesNotificationDocument,
    "\n  query Retroplanning($editionId: ID!) {\n    moi {\n      id\n      estAdmin\n      affectations(editionId: $editionId) {\n        id\n        perimetre {\n          id\n        }\n      }\n    }\n    retroplanning(editionId: $editionId) {\n      id\n      titre\n      echeance\n      statut\n      enRetard\n      perimetre {\n        id\n        slug\n        nom\n        type\n        couleur\n      }\n      assignes {\n        id\n        nom\n      }\n    }\n  }\n": typeof types.RetroplanningDocument,
    "\n  query AvancementGlobal($editionId: ID!) {\n    avancementGlobal(editionId: $editionId) {\n      perimetre {\n        id\n        slug\n        nom\n        couleur\n        referents(editionId: $editionId) {\n          id\n          nom\n        }\n      }\n      avancement {\n        total\n        aFaire\n        enCours\n        faites\n        abandonnees\n        enRetard\n        sansPersonne\n      }\n    }\n  }\n": typeof types.AvancementGlobalDocument,
    "\n  query Classement($editionId: ID!) {\n    classement(editionId: $editionId) {\n      rang\n      personne {\n        id\n        nom\n      }\n      score {\n        points\n        tachesRealisees\n        tachesATemps\n        tachesCreees\n        fichesCreees\n        fichesModifiees\n      }\n    }\n  }\n": typeof types.ClassementDocument,
    "\n  mutation CreerEdition(\n    $annee: Int!\n    $nom: String!\n    $debut: Date!\n    $fin: Date!\n  ) {\n    creerEdition(annee: $annee, nom: $nom, debut: $debut, fin: $fin) {\n      id\n    }\n  }\n": typeof types.CreerEditionDocument,
    "\n  mutation ModifierEdition(\n    $id: ID!\n    $nom: String!\n    $debut: Date!\n    $fin: Date!\n    $statut: StatutEdition!\n  ) {\n    modifierEdition(\n      id: $id\n      nom: $nom\n      debut: $debut\n      fin: $fin\n      statut: $statut\n    ) {\n      id\n      nom\n      debut\n      fin\n      statut\n    }\n  }\n": typeof types.ModifierEditionDocument,
    "\n  mutation CreerPerimetre(\n    $slug: String!\n    $nom: String!\n    $type: TypePerimetre!\n    $couleur: String\n    $ordre: Int\n  ) {\n    creerPerimetre(\n      slug: $slug\n      nom: $nom\n      type: $type\n      couleur: $couleur\n      ordre: $ordre\n    ) {\n      id\n    }\n  }\n": typeof types.CreerPerimetreDocument,
    "\n  mutation ModifierPerimetre(\n    $id: ID!\n    $nom: String!\n    $type: TypePerimetre!\n    $couleur: String\n    $ordre: Int!\n    $archive: Boolean!\n  ) {\n    modifierPerimetre(\n      id: $id\n      nom: $nom\n      type: $type\n      couleur: $couleur\n      ordre: $ordre\n      archive: $archive\n    ) {\n      id\n    }\n  }\n": typeof types.ModifierPerimetreDocument,
    "\n  query Personnes($inclureArchives: Boolean, $editionId: ID) {\n    personnes(inclureArchives: $inclureArchives) {\n      id\n      nom\n      email\n      estAdmin\n      archive\n      affectations(editionId: $editionId) {\n        id\n        perimetre {\n          id\n          nom\n          couleur\n        }\n      }\n      souhaits(editionId: $editionId) {\n        id\n        satisfait\n        perimetre {\n          id\n          nom\n          couleur\n        }\n      }\n    }\n  }\n": typeof types.PersonnesDocument,
    "\n  mutation InviterPersonne(\n    $email: String!\n    $nom: String!\n    $estAdmin: Boolean\n    $editionId: ID\n    $perimetresSouhaites: [ID!]\n  ) {\n    inviterPersonne(\n      email: $email\n      nom: $nom\n      estAdmin: $estAdmin\n      editionId: $editionId\n      perimetresSouhaites: $perimetresSouhaites\n    ) {\n      id\n    }\n  }\n": typeof types.InviterPersonneDocument,
    "\n  mutation ModifierPersonne($id: ID!, $nom: String!, $estAdmin: Boolean!) {\n    modifierPersonne(id: $id, nom: $nom, estAdmin: $estAdmin) {\n      id\n      nom\n      estAdmin\n    }\n  }\n": typeof types.ModifierPersonneDocument,
    "\n  mutation ArchiverPersonne($id: ID!, $archive: Boolean!) {\n    archiverPersonne(id: $id, archive: $archive) {\n      id\n      archive\n    }\n  }\n": typeof types.ArchiverPersonneDocument,
    "\n  mutation DefinirSouhaits(\n    $personneId: ID!\n    $editionId: ID!\n    $perimetreIds: [ID!]!\n  ) {\n    definirSouhaits(\n      personneId: $personneId\n      editionId: $editionId\n      perimetreIds: $perimetreIds\n    ) {\n      id\n    }\n  }\n": typeof types.DefinirSouhaitsDocument,
    "\n  mutation RenvoyerInvitation($id: ID!) {\n    renvoyerInvitation(id: $id)\n  }\n": typeof types.RenvoyerInvitationDocument,
    "\n  query PostesAPourvoir($editionId: ID!) {\n    postesAPourvoir(editionId: $editionId) {\n      effectif\n      aPourvoir\n      etat\n      perimetre {\n        id\n        slug\n        nom\n        type\n        couleur\n      }\n      affectations {\n        id\n        personne {\n          id\n          nom\n        }\n      }\n      souhaits {\n        id\n        personne {\n          id\n          nom\n        }\n      }\n    }\n    appelPostes(editionId: $editionId)\n    personnes {\n      id\n      nom\n    }\n  }\n": typeof types.PostesAPourvoirDocument,
    "\n  mutation DefinirEffectif(\n    $perimetreId: ID!\n    $editionId: ID!\n    $effectif: Int!\n  ) {\n    definirEffectif(\n      perimetreId: $perimetreId\n      editionId: $editionId\n      effectif: $effectif\n    )\n  }\n": typeof types.DefinirEffectifDocument,
    "\n  mutation Affecter($personneId: ID!, $perimetreId: ID!, $editionId: ID!) {\n    affecter(\n      personneId: $personneId\n      perimetreId: $perimetreId\n      editionId: $editionId\n    ) {\n      id\n    }\n  }\n": typeof types.AffecterDocument,
    "\n  mutation RetirerAffectation($id: ID!) {\n    retirerAffectation(id: $id)\n  }\n": typeof types.RetirerAffectationDocument,
    "\n  mutation RetirerSouhait($id: ID!) {\n    retirerSouhait(id: $id)\n  }\n": typeof types.RetirerSouhaitDocument,
    "\n  query DroitsRedaction {\n    droitsRedaction {\n      id\n      accordeLe\n      personne {\n        id\n        nom\n      }\n      perimetre {\n        id\n        nom\n      }\n    }\n    personnes {\n      id\n      nom\n    }\n  }\n": typeof types.DroitsRedactionDocument,
    "\n  mutation AccorderDroitRedaction($personneId: ID!, $perimetreId: ID) {\n    accorderDroitRedaction(personneId: $personneId, perimetreId: $perimetreId) {\n      id\n    }\n  }\n": typeof types.AccorderDroitRedactionDocument,
    "\n  mutation RetirerDroitRedaction($id: ID!) {\n    retirerDroitRedaction(id: $id)\n  }\n": typeof types.RetirerDroitRedactionDocument,
};
const documents: Documents = {
    "\n  query MonScore($editionId: ID!) {\n    monScore(editionId: $editionId) {\n      points\n      tachesRealisees\n      tachesATemps\n      tachesCreees\n      fichesCreees\n      fichesModifiees\n    }\n    baremeScore {\n      tacheRealisee\n      bonusATemps\n      tacheCreee\n      ficheCreee\n      ficheModifiee\n    }\n  }\n": types.MonScoreDocument,
    "\n  query MenuPerimetres {\n    moi {\n      id\n      affectations {\n        id\n        perimetre {\n          id\n          slug\n          nom\n        }\n      }\n    }\n  }\n": types.MenuPerimetresDocument,
    "\n  query NombreNotificationsNonLues {\n    nombreNotificationsNonLues\n  }\n": types.NombreNotificationsNonLuesDocument,
    "\n  query ListeNotifications {\n    notifications(limite: 40) {\n      id\n      type\n      message\n      lien\n      lue\n      creeLe\n    }\n  }\n": types.ListeNotificationsDocument,
    "\n  mutation MarquerNotificationsLues($ids: [ID!]) {\n    marquerNotificationsLues(ids: $ids)\n  }\n": types.MarquerNotificationsLuesDocument,
    "\n  query Fiche($slug: String!) {\n    moi {\n      id\n      estAdmin\n    }\n    fiche(slug: $slug) {\n      id\n      slug\n      titre\n      contenu\n      source\n      archive\n      modifieeLe\n      modifieePar\n      peutModifier\n      donneesPersonnelles\n      perimetre {\n        id\n        slug\n        nom\n        couleur\n      }\n    }\n  }\n": types.FicheDocument,
    "\n  query VersionsFiche($slug: String!) {\n    fiche(slug: $slug) {\n      id\n      versionCouranteId\n      versions {\n        id\n        titre\n        contenu\n        source\n        resume\n        creeLe\n        auteur {\n          id\n          nom\n        }\n      }\n    }\n  }\n": types.VersionsFicheDocument,
    "\n  query ListeFiches {\n    fiches {\n      id\n      slug\n      titre\n      modifieeLe\n      perimetre {\n        id\n        slug\n        nom\n        couleur\n      }\n    }\n    peutRedigerFichesCommunes\n  }\n": types.ListeFichesDocument,
    "\n  mutation CreerFiche(\n    $slug: String!\n    $titre: String!\n    $contenu: String!\n    $perimetreId: ID\n  ) {\n    creerFiche(\n      slug: $slug\n      titre: $titre\n      contenu: $contenu\n      perimetreId: $perimetreId\n    ) {\n      id\n      slug\n    }\n  }\n": types.CreerFicheDocument,
    "\n  mutation ModifierFiche(\n    $id: ID!\n    $titre: String!\n    $contenu: String!\n    $resume: String\n  ) {\n    modifierFiche(id: $id, titre: $titre, contenu: $contenu, resume: $resume) {\n      id\n      slug\n      titre\n      contenu\n      modifieeLe\n      modifieePar\n      source\n      donneesPersonnelles\n    }\n  }\n": types.ModifierFicheDocument,
    "\n  mutation RestaurerVersionFiche($versionId: ID!) {\n    restaurerVersionFiche(versionId: $versionId) {\n      id\n      titre\n      contenu\n      modifieeLe\n      modifieePar\n      source\n    }\n  }\n": types.RestaurerVersionFicheDocument,
    "\n  query Moi {\n    moi {\n      id\n      nom\n      email\n      estAdmin\n    }\n  }\n": types.MoiDocument,
    "\n  query EditionCourante {\n    editionCourante {\n      id\n      annee\n      nom\n      debut\n      fin\n      statut\n    }\n  }\n": types.EditionCouranteDocument,
    "\n  query Editions {\n    editions {\n      id\n      annee\n      nom\n      debut\n      fin\n      statut\n    }\n  }\n": types.EditionsDocument,
    "\n  query Perimetres($inclureArchives: Boolean) {\n    perimetres(inclureArchives: $inclureArchives) {\n      id\n      slug\n      nom\n      type\n      couleur\n      ordre\n      archive\n    }\n  }\n": types.PerimetresDocument,
    "\n  fragment TacheChamps on Tache {\n    id\n    titre\n    description\n    echeance\n    statut\n    enRetard\n    termineeLe\n    perimetre {\n      id\n      slug\n      nom\n      couleur\n    }\n    assignes {\n      id\n      nom\n    }\n    clotureePar {\n      id\n      nom\n    }\n    realiseePar {\n      id\n      nom\n    }\n    fiche {\n      id\n      slug\n      titre\n    }\n  }\n": types.TacheChampsFragmentDoc,
    "\n  mutation CreerTache(\n    $perimetreId: ID!\n    $editionId: ID!\n    $titre: String!\n    $description: String\n    $echeance: Date\n    $ficheId: ID\n    $mAssigner: Boolean\n  ) {\n    creerTache(\n      perimetreId: $perimetreId\n      editionId: $editionId\n      titre: $titre\n      description: $description\n      echeance: $echeance\n      ficheId: $ficheId\n      mAssigner: $mAssigner\n    ) {\n      ...TacheChamps\n    }\n  }\n": types.CreerTacheDocument,
    "\n  mutation ModifierTache(\n    $id: ID!\n    $titre: String!\n    $description: String\n    $echeance: Date\n    $ficheId: ID\n    $confirmer: Boolean\n  ) {\n    modifierTache(\n      id: $id\n      titre: $titre\n      description: $description\n      echeance: $echeance\n      ficheId: $ficheId\n      confirmer: $confirmer\n    ) {\n      ...TacheChamps\n    }\n  }\n": types.ModifierTacheDocument,
    "\n  mutation ChangerStatutTache(\n    $id: ID!\n    $statut: StatutTache!\n    $realiseeParId: ID\n    $confirmer: Boolean\n  ) {\n    changerStatutTache(\n      id: $id\n      statut: $statut\n      realiseeParId: $realiseeParId\n      confirmer: $confirmer\n    ) {\n      ...TacheChamps\n    }\n  }\n": types.ChangerStatutTacheDocument,
    "\n  mutation AssignerTache($id: ID!, $assigne: Boolean!, $personneId: ID) {\n    assignerTache(id: $id, assigne: $assigne, personneId: $personneId) {\n      ...TacheChamps\n    }\n  }\n": types.AssignerTacheDocument,
    "\n  query PerimetreCibleFiche($slug: String!) {\n    perimetre(slug: $slug) {\n      id\n      nom\n      peutRedigerFiches\n    }\n  }\n": types.PerimetreCibleFicheDocument,
    "\n  query DroitFichesCommunes {\n    peutRedigerFichesCommunes\n  }\n": types.DroitFichesCommunesDocument,
    "\n  query MesTaches($editionId: ID!) {\n    moi {\n      id\n      affectations(editionId: $editionId) {\n        id\n        perimetre {\n          id\n          slug\n          nom\n          type\n          couleur\n          referents(editionId: $editionId) {\n            id\n            nom\n          }\n          avancement(editionId: $editionId) {\n            total\n            faites\n            abandonnees\n            enRetard\n            sansPersonne\n          }\n        }\n      }\n    }\n    mesTaches(editionId: $editionId) {\n      ...TacheChamps\n    }\n    tachesAPrendre(editionId: $editionId) {\n      ...TacheChamps\n    }\n  }\n": types.MesTachesDocument,
    "\n  query PagePerimetre($slug: String!, $editionId: ID!) {\n    moi {\n      id\n    }\n    perimetre(slug: $slug) {\n      id\n      nom\n      type\n      couleur\n      peutModifier(editionId: $editionId)\n      referents(editionId: $editionId) {\n        id\n        nom\n      }\n      avancement(editionId: $editionId) {\n        total\n        aFaire\n        enCours\n        faites\n        abandonnees\n        enRetard\n        sansPersonne\n      }\n      taches(editionId: $editionId) {\n        ...TacheChamps\n      }\n      peutRedigerFiches\n      fiches {\n        id\n        slug\n        titre\n      }\n    }\n    fichesCommunes: fiches {\n      id\n      titre\n      perimetre {\n        id\n      }\n    }\n  }\n": types.PagePerimetreDocument,
    "\n  query MesPreferencesNotification {\n    mesPreferencesNotification {\n      frequenceResume\n      mailModification\n      mailEcheance\n    }\n  }\n": types.MesPreferencesNotificationDocument,
    "\n  mutation ModifierPreferencesNotification(\n    $frequenceResume: FrequenceResume!\n    $mailModification: Boolean!\n    $mailEcheance: Boolean!\n  ) {\n    modifierPreferencesNotification(\n      frequenceResume: $frequenceResume\n      mailModification: $mailModification\n      mailEcheance: $mailEcheance\n    ) {\n      frequenceResume\n      mailModification\n      mailEcheance\n    }\n  }\n": types.ModifierPreferencesNotificationDocument,
    "\n  query Retroplanning($editionId: ID!) {\n    moi {\n      id\n      estAdmin\n      affectations(editionId: $editionId) {\n        id\n        perimetre {\n          id\n        }\n      }\n    }\n    retroplanning(editionId: $editionId) {\n      id\n      titre\n      echeance\n      statut\n      enRetard\n      perimetre {\n        id\n        slug\n        nom\n        type\n        couleur\n      }\n      assignes {\n        id\n        nom\n      }\n    }\n  }\n": types.RetroplanningDocument,
    "\n  query AvancementGlobal($editionId: ID!) {\n    avancementGlobal(editionId: $editionId) {\n      perimetre {\n        id\n        slug\n        nom\n        couleur\n        referents(editionId: $editionId) {\n          id\n          nom\n        }\n      }\n      avancement {\n        total\n        aFaire\n        enCours\n        faites\n        abandonnees\n        enRetard\n        sansPersonne\n      }\n    }\n  }\n": types.AvancementGlobalDocument,
    "\n  query Classement($editionId: ID!) {\n    classement(editionId: $editionId) {\n      rang\n      personne {\n        id\n        nom\n      }\n      score {\n        points\n        tachesRealisees\n        tachesATemps\n        tachesCreees\n        fichesCreees\n        fichesModifiees\n      }\n    }\n  }\n": types.ClassementDocument,
    "\n  mutation CreerEdition(\n    $annee: Int!\n    $nom: String!\n    $debut: Date!\n    $fin: Date!\n  ) {\n    creerEdition(annee: $annee, nom: $nom, debut: $debut, fin: $fin) {\n      id\n    }\n  }\n": types.CreerEditionDocument,
    "\n  mutation ModifierEdition(\n    $id: ID!\n    $nom: String!\n    $debut: Date!\n    $fin: Date!\n    $statut: StatutEdition!\n  ) {\n    modifierEdition(\n      id: $id\n      nom: $nom\n      debut: $debut\n      fin: $fin\n      statut: $statut\n    ) {\n      id\n      nom\n      debut\n      fin\n      statut\n    }\n  }\n": types.ModifierEditionDocument,
    "\n  mutation CreerPerimetre(\n    $slug: String!\n    $nom: String!\n    $type: TypePerimetre!\n    $couleur: String\n    $ordre: Int\n  ) {\n    creerPerimetre(\n      slug: $slug\n      nom: $nom\n      type: $type\n      couleur: $couleur\n      ordre: $ordre\n    ) {\n      id\n    }\n  }\n": types.CreerPerimetreDocument,
    "\n  mutation ModifierPerimetre(\n    $id: ID!\n    $nom: String!\n    $type: TypePerimetre!\n    $couleur: String\n    $ordre: Int!\n    $archive: Boolean!\n  ) {\n    modifierPerimetre(\n      id: $id\n      nom: $nom\n      type: $type\n      couleur: $couleur\n      ordre: $ordre\n      archive: $archive\n    ) {\n      id\n    }\n  }\n": types.ModifierPerimetreDocument,
    "\n  query Personnes($inclureArchives: Boolean, $editionId: ID) {\n    personnes(inclureArchives: $inclureArchives) {\n      id\n      nom\n      email\n      estAdmin\n      archive\n      affectations(editionId: $editionId) {\n        id\n        perimetre {\n          id\n          nom\n          couleur\n        }\n      }\n      souhaits(editionId: $editionId) {\n        id\n        satisfait\n        perimetre {\n          id\n          nom\n          couleur\n        }\n      }\n    }\n  }\n": types.PersonnesDocument,
    "\n  mutation InviterPersonne(\n    $email: String!\n    $nom: String!\n    $estAdmin: Boolean\n    $editionId: ID\n    $perimetresSouhaites: [ID!]\n  ) {\n    inviterPersonne(\n      email: $email\n      nom: $nom\n      estAdmin: $estAdmin\n      editionId: $editionId\n      perimetresSouhaites: $perimetresSouhaites\n    ) {\n      id\n    }\n  }\n": types.InviterPersonneDocument,
    "\n  mutation ModifierPersonne($id: ID!, $nom: String!, $estAdmin: Boolean!) {\n    modifierPersonne(id: $id, nom: $nom, estAdmin: $estAdmin) {\n      id\n      nom\n      estAdmin\n    }\n  }\n": types.ModifierPersonneDocument,
    "\n  mutation ArchiverPersonne($id: ID!, $archive: Boolean!) {\n    archiverPersonne(id: $id, archive: $archive) {\n      id\n      archive\n    }\n  }\n": types.ArchiverPersonneDocument,
    "\n  mutation DefinirSouhaits(\n    $personneId: ID!\n    $editionId: ID!\n    $perimetreIds: [ID!]!\n  ) {\n    definirSouhaits(\n      personneId: $personneId\n      editionId: $editionId\n      perimetreIds: $perimetreIds\n    ) {\n      id\n    }\n  }\n": types.DefinirSouhaitsDocument,
    "\n  mutation RenvoyerInvitation($id: ID!) {\n    renvoyerInvitation(id: $id)\n  }\n": types.RenvoyerInvitationDocument,
    "\n  query PostesAPourvoir($editionId: ID!) {\n    postesAPourvoir(editionId: $editionId) {\n      effectif\n      aPourvoir\n      etat\n      perimetre {\n        id\n        slug\n        nom\n        type\n        couleur\n      }\n      affectations {\n        id\n        personne {\n          id\n          nom\n        }\n      }\n      souhaits {\n        id\n        personne {\n          id\n          nom\n        }\n      }\n    }\n    appelPostes(editionId: $editionId)\n    personnes {\n      id\n      nom\n    }\n  }\n": types.PostesAPourvoirDocument,
    "\n  mutation DefinirEffectif(\n    $perimetreId: ID!\n    $editionId: ID!\n    $effectif: Int!\n  ) {\n    definirEffectif(\n      perimetreId: $perimetreId\n      editionId: $editionId\n      effectif: $effectif\n    )\n  }\n": types.DefinirEffectifDocument,
    "\n  mutation Affecter($personneId: ID!, $perimetreId: ID!, $editionId: ID!) {\n    affecter(\n      personneId: $personneId\n      perimetreId: $perimetreId\n      editionId: $editionId\n    ) {\n      id\n    }\n  }\n": types.AffecterDocument,
    "\n  mutation RetirerAffectation($id: ID!) {\n    retirerAffectation(id: $id)\n  }\n": types.RetirerAffectationDocument,
    "\n  mutation RetirerSouhait($id: ID!) {\n    retirerSouhait(id: $id)\n  }\n": types.RetirerSouhaitDocument,
    "\n  query DroitsRedaction {\n    droitsRedaction {\n      id\n      accordeLe\n      personne {\n        id\n        nom\n      }\n      perimetre {\n        id\n        nom\n      }\n    }\n    personnes {\n      id\n      nom\n    }\n  }\n": types.DroitsRedactionDocument,
    "\n  mutation AccorderDroitRedaction($personneId: ID!, $perimetreId: ID) {\n    accorderDroitRedaction(personneId: $personneId, perimetreId: $perimetreId) {\n      id\n    }\n  }\n": types.AccorderDroitRedactionDocument,
    "\n  mutation RetirerDroitRedaction($id: ID!) {\n    retirerDroitRedaction(id: $id)\n  }\n": types.RetirerDroitRedactionDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MonScore($editionId: ID!) {\n    monScore(editionId: $editionId) {\n      points\n      tachesRealisees\n      tachesATemps\n      tachesCreees\n      fichesCreees\n      fichesModifiees\n    }\n    baremeScore {\n      tacheRealisee\n      bonusATemps\n      tacheCreee\n      ficheCreee\n      ficheModifiee\n    }\n  }\n"): (typeof documents)["\n  query MonScore($editionId: ID!) {\n    monScore(editionId: $editionId) {\n      points\n      tachesRealisees\n      tachesATemps\n      tachesCreees\n      fichesCreees\n      fichesModifiees\n    }\n    baremeScore {\n      tacheRealisee\n      bonusATemps\n      tacheCreee\n      ficheCreee\n      ficheModifiee\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MenuPerimetres {\n    moi {\n      id\n      affectations {\n        id\n        perimetre {\n          id\n          slug\n          nom\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query MenuPerimetres {\n    moi {\n      id\n      affectations {\n        id\n        perimetre {\n          id\n          slug\n          nom\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query NombreNotificationsNonLues {\n    nombreNotificationsNonLues\n  }\n"): (typeof documents)["\n  query NombreNotificationsNonLues {\n    nombreNotificationsNonLues\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ListeNotifications {\n    notifications(limite: 40) {\n      id\n      type\n      message\n      lien\n      lue\n      creeLe\n    }\n  }\n"): (typeof documents)["\n  query ListeNotifications {\n    notifications(limite: 40) {\n      id\n      type\n      message\n      lien\n      lue\n      creeLe\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MarquerNotificationsLues($ids: [ID!]) {\n    marquerNotificationsLues(ids: $ids)\n  }\n"): (typeof documents)["\n  mutation MarquerNotificationsLues($ids: [ID!]) {\n    marquerNotificationsLues(ids: $ids)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Fiche($slug: String!) {\n    moi {\n      id\n      estAdmin\n    }\n    fiche(slug: $slug) {\n      id\n      slug\n      titre\n      contenu\n      source\n      archive\n      modifieeLe\n      modifieePar\n      peutModifier\n      donneesPersonnelles\n      perimetre {\n        id\n        slug\n        nom\n        couleur\n      }\n    }\n  }\n"): (typeof documents)["\n  query Fiche($slug: String!) {\n    moi {\n      id\n      estAdmin\n    }\n    fiche(slug: $slug) {\n      id\n      slug\n      titre\n      contenu\n      source\n      archive\n      modifieeLe\n      modifieePar\n      peutModifier\n      donneesPersonnelles\n      perimetre {\n        id\n        slug\n        nom\n        couleur\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query VersionsFiche($slug: String!) {\n    fiche(slug: $slug) {\n      id\n      versionCouranteId\n      versions {\n        id\n        titre\n        contenu\n        source\n        resume\n        creeLe\n        auteur {\n          id\n          nom\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query VersionsFiche($slug: String!) {\n    fiche(slug: $slug) {\n      id\n      versionCouranteId\n      versions {\n        id\n        titre\n        contenu\n        source\n        resume\n        creeLe\n        auteur {\n          id\n          nom\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ListeFiches {\n    fiches {\n      id\n      slug\n      titre\n      modifieeLe\n      perimetre {\n        id\n        slug\n        nom\n        couleur\n      }\n    }\n    peutRedigerFichesCommunes\n  }\n"): (typeof documents)["\n  query ListeFiches {\n    fiches {\n      id\n      slug\n      titre\n      modifieeLe\n      perimetre {\n        id\n        slug\n        nom\n        couleur\n      }\n    }\n    peutRedigerFichesCommunes\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreerFiche(\n    $slug: String!\n    $titre: String!\n    $contenu: String!\n    $perimetreId: ID\n  ) {\n    creerFiche(\n      slug: $slug\n      titre: $titre\n      contenu: $contenu\n      perimetreId: $perimetreId\n    ) {\n      id\n      slug\n    }\n  }\n"): (typeof documents)["\n  mutation CreerFiche(\n    $slug: String!\n    $titre: String!\n    $contenu: String!\n    $perimetreId: ID\n  ) {\n    creerFiche(\n      slug: $slug\n      titre: $titre\n      contenu: $contenu\n      perimetreId: $perimetreId\n    ) {\n      id\n      slug\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ModifierFiche(\n    $id: ID!\n    $titre: String!\n    $contenu: String!\n    $resume: String\n  ) {\n    modifierFiche(id: $id, titre: $titre, contenu: $contenu, resume: $resume) {\n      id\n      slug\n      titre\n      contenu\n      modifieeLe\n      modifieePar\n      source\n      donneesPersonnelles\n    }\n  }\n"): (typeof documents)["\n  mutation ModifierFiche(\n    $id: ID!\n    $titre: String!\n    $contenu: String!\n    $resume: String\n  ) {\n    modifierFiche(id: $id, titre: $titre, contenu: $contenu, resume: $resume) {\n      id\n      slug\n      titre\n      contenu\n      modifieeLe\n      modifieePar\n      source\n      donneesPersonnelles\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RestaurerVersionFiche($versionId: ID!) {\n    restaurerVersionFiche(versionId: $versionId) {\n      id\n      titre\n      contenu\n      modifieeLe\n      modifieePar\n      source\n    }\n  }\n"): (typeof documents)["\n  mutation RestaurerVersionFiche($versionId: ID!) {\n    restaurerVersionFiche(versionId: $versionId) {\n      id\n      titre\n      contenu\n      modifieeLe\n      modifieePar\n      source\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Moi {\n    moi {\n      id\n      nom\n      email\n      estAdmin\n    }\n  }\n"): (typeof documents)["\n  query Moi {\n    moi {\n      id\n      nom\n      email\n      estAdmin\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query EditionCourante {\n    editionCourante {\n      id\n      annee\n      nom\n      debut\n      fin\n      statut\n    }\n  }\n"): (typeof documents)["\n  query EditionCourante {\n    editionCourante {\n      id\n      annee\n      nom\n      debut\n      fin\n      statut\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Editions {\n    editions {\n      id\n      annee\n      nom\n      debut\n      fin\n      statut\n    }\n  }\n"): (typeof documents)["\n  query Editions {\n    editions {\n      id\n      annee\n      nom\n      debut\n      fin\n      statut\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Perimetres($inclureArchives: Boolean) {\n    perimetres(inclureArchives: $inclureArchives) {\n      id\n      slug\n      nom\n      type\n      couleur\n      ordre\n      archive\n    }\n  }\n"): (typeof documents)["\n  query Perimetres($inclureArchives: Boolean) {\n    perimetres(inclureArchives: $inclureArchives) {\n      id\n      slug\n      nom\n      type\n      couleur\n      ordre\n      archive\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TacheChamps on Tache {\n    id\n    titre\n    description\n    echeance\n    statut\n    enRetard\n    termineeLe\n    perimetre {\n      id\n      slug\n      nom\n      couleur\n    }\n    assignes {\n      id\n      nom\n    }\n    clotureePar {\n      id\n      nom\n    }\n    realiseePar {\n      id\n      nom\n    }\n    fiche {\n      id\n      slug\n      titre\n    }\n  }\n"): (typeof documents)["\n  fragment TacheChamps on Tache {\n    id\n    titre\n    description\n    echeance\n    statut\n    enRetard\n    termineeLe\n    perimetre {\n      id\n      slug\n      nom\n      couleur\n    }\n    assignes {\n      id\n      nom\n    }\n    clotureePar {\n      id\n      nom\n    }\n    realiseePar {\n      id\n      nom\n    }\n    fiche {\n      id\n      slug\n      titre\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreerTache(\n    $perimetreId: ID!\n    $editionId: ID!\n    $titre: String!\n    $description: String\n    $echeance: Date\n    $ficheId: ID\n    $mAssigner: Boolean\n  ) {\n    creerTache(\n      perimetreId: $perimetreId\n      editionId: $editionId\n      titre: $titre\n      description: $description\n      echeance: $echeance\n      ficheId: $ficheId\n      mAssigner: $mAssigner\n    ) {\n      ...TacheChamps\n    }\n  }\n"): (typeof documents)["\n  mutation CreerTache(\n    $perimetreId: ID!\n    $editionId: ID!\n    $titre: String!\n    $description: String\n    $echeance: Date\n    $ficheId: ID\n    $mAssigner: Boolean\n  ) {\n    creerTache(\n      perimetreId: $perimetreId\n      editionId: $editionId\n      titre: $titre\n      description: $description\n      echeance: $echeance\n      ficheId: $ficheId\n      mAssigner: $mAssigner\n    ) {\n      ...TacheChamps\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ModifierTache(\n    $id: ID!\n    $titre: String!\n    $description: String\n    $echeance: Date\n    $ficheId: ID\n    $confirmer: Boolean\n  ) {\n    modifierTache(\n      id: $id\n      titre: $titre\n      description: $description\n      echeance: $echeance\n      ficheId: $ficheId\n      confirmer: $confirmer\n    ) {\n      ...TacheChamps\n    }\n  }\n"): (typeof documents)["\n  mutation ModifierTache(\n    $id: ID!\n    $titre: String!\n    $description: String\n    $echeance: Date\n    $ficheId: ID\n    $confirmer: Boolean\n  ) {\n    modifierTache(\n      id: $id\n      titre: $titre\n      description: $description\n      echeance: $echeance\n      ficheId: $ficheId\n      confirmer: $confirmer\n    ) {\n      ...TacheChamps\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ChangerStatutTache(\n    $id: ID!\n    $statut: StatutTache!\n    $realiseeParId: ID\n    $confirmer: Boolean\n  ) {\n    changerStatutTache(\n      id: $id\n      statut: $statut\n      realiseeParId: $realiseeParId\n      confirmer: $confirmer\n    ) {\n      ...TacheChamps\n    }\n  }\n"): (typeof documents)["\n  mutation ChangerStatutTache(\n    $id: ID!\n    $statut: StatutTache!\n    $realiseeParId: ID\n    $confirmer: Boolean\n  ) {\n    changerStatutTache(\n      id: $id\n      statut: $statut\n      realiseeParId: $realiseeParId\n      confirmer: $confirmer\n    ) {\n      ...TacheChamps\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AssignerTache($id: ID!, $assigne: Boolean!, $personneId: ID) {\n    assignerTache(id: $id, assigne: $assigne, personneId: $personneId) {\n      ...TacheChamps\n    }\n  }\n"): (typeof documents)["\n  mutation AssignerTache($id: ID!, $assigne: Boolean!, $personneId: ID) {\n    assignerTache(id: $id, assigne: $assigne, personneId: $personneId) {\n      ...TacheChamps\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PerimetreCibleFiche($slug: String!) {\n    perimetre(slug: $slug) {\n      id\n      nom\n      peutRedigerFiches\n    }\n  }\n"): (typeof documents)["\n  query PerimetreCibleFiche($slug: String!) {\n    perimetre(slug: $slug) {\n      id\n      nom\n      peutRedigerFiches\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query DroitFichesCommunes {\n    peutRedigerFichesCommunes\n  }\n"): (typeof documents)["\n  query DroitFichesCommunes {\n    peutRedigerFichesCommunes\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MesTaches($editionId: ID!) {\n    moi {\n      id\n      affectations(editionId: $editionId) {\n        id\n        perimetre {\n          id\n          slug\n          nom\n          type\n          couleur\n          referents(editionId: $editionId) {\n            id\n            nom\n          }\n          avancement(editionId: $editionId) {\n            total\n            faites\n            abandonnees\n            enRetard\n            sansPersonne\n          }\n        }\n      }\n    }\n    mesTaches(editionId: $editionId) {\n      ...TacheChamps\n    }\n    tachesAPrendre(editionId: $editionId) {\n      ...TacheChamps\n    }\n  }\n"): (typeof documents)["\n  query MesTaches($editionId: ID!) {\n    moi {\n      id\n      affectations(editionId: $editionId) {\n        id\n        perimetre {\n          id\n          slug\n          nom\n          type\n          couleur\n          referents(editionId: $editionId) {\n            id\n            nom\n          }\n          avancement(editionId: $editionId) {\n            total\n            faites\n            abandonnees\n            enRetard\n            sansPersonne\n          }\n        }\n      }\n    }\n    mesTaches(editionId: $editionId) {\n      ...TacheChamps\n    }\n    tachesAPrendre(editionId: $editionId) {\n      ...TacheChamps\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PagePerimetre($slug: String!, $editionId: ID!) {\n    moi {\n      id\n    }\n    perimetre(slug: $slug) {\n      id\n      nom\n      type\n      couleur\n      peutModifier(editionId: $editionId)\n      referents(editionId: $editionId) {\n        id\n        nom\n      }\n      avancement(editionId: $editionId) {\n        total\n        aFaire\n        enCours\n        faites\n        abandonnees\n        enRetard\n        sansPersonne\n      }\n      taches(editionId: $editionId) {\n        ...TacheChamps\n      }\n      peutRedigerFiches\n      fiches {\n        id\n        slug\n        titre\n      }\n    }\n    fichesCommunes: fiches {\n      id\n      titre\n      perimetre {\n        id\n      }\n    }\n  }\n"): (typeof documents)["\n  query PagePerimetre($slug: String!, $editionId: ID!) {\n    moi {\n      id\n    }\n    perimetre(slug: $slug) {\n      id\n      nom\n      type\n      couleur\n      peutModifier(editionId: $editionId)\n      referents(editionId: $editionId) {\n        id\n        nom\n      }\n      avancement(editionId: $editionId) {\n        total\n        aFaire\n        enCours\n        faites\n        abandonnees\n        enRetard\n        sansPersonne\n      }\n      taches(editionId: $editionId) {\n        ...TacheChamps\n      }\n      peutRedigerFiches\n      fiches {\n        id\n        slug\n        titre\n      }\n    }\n    fichesCommunes: fiches {\n      id\n      titre\n      perimetre {\n        id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MesPreferencesNotification {\n    mesPreferencesNotification {\n      frequenceResume\n      mailModification\n      mailEcheance\n    }\n  }\n"): (typeof documents)["\n  query MesPreferencesNotification {\n    mesPreferencesNotification {\n      frequenceResume\n      mailModification\n      mailEcheance\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ModifierPreferencesNotification(\n    $frequenceResume: FrequenceResume!\n    $mailModification: Boolean!\n    $mailEcheance: Boolean!\n  ) {\n    modifierPreferencesNotification(\n      frequenceResume: $frequenceResume\n      mailModification: $mailModification\n      mailEcheance: $mailEcheance\n    ) {\n      frequenceResume\n      mailModification\n      mailEcheance\n    }\n  }\n"): (typeof documents)["\n  mutation ModifierPreferencesNotification(\n    $frequenceResume: FrequenceResume!\n    $mailModification: Boolean!\n    $mailEcheance: Boolean!\n  ) {\n    modifierPreferencesNotification(\n      frequenceResume: $frequenceResume\n      mailModification: $mailModification\n      mailEcheance: $mailEcheance\n    ) {\n      frequenceResume\n      mailModification\n      mailEcheance\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Retroplanning($editionId: ID!) {\n    moi {\n      id\n      estAdmin\n      affectations(editionId: $editionId) {\n        id\n        perimetre {\n          id\n        }\n      }\n    }\n    retroplanning(editionId: $editionId) {\n      id\n      titre\n      echeance\n      statut\n      enRetard\n      perimetre {\n        id\n        slug\n        nom\n        type\n        couleur\n      }\n      assignes {\n        id\n        nom\n      }\n    }\n  }\n"): (typeof documents)["\n  query Retroplanning($editionId: ID!) {\n    moi {\n      id\n      estAdmin\n      affectations(editionId: $editionId) {\n        id\n        perimetre {\n          id\n        }\n      }\n    }\n    retroplanning(editionId: $editionId) {\n      id\n      titre\n      echeance\n      statut\n      enRetard\n      perimetre {\n        id\n        slug\n        nom\n        type\n        couleur\n      }\n      assignes {\n        id\n        nom\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query AvancementGlobal($editionId: ID!) {\n    avancementGlobal(editionId: $editionId) {\n      perimetre {\n        id\n        slug\n        nom\n        couleur\n        referents(editionId: $editionId) {\n          id\n          nom\n        }\n      }\n      avancement {\n        total\n        aFaire\n        enCours\n        faites\n        abandonnees\n        enRetard\n        sansPersonne\n      }\n    }\n  }\n"): (typeof documents)["\n  query AvancementGlobal($editionId: ID!) {\n    avancementGlobal(editionId: $editionId) {\n      perimetre {\n        id\n        slug\n        nom\n        couleur\n        referents(editionId: $editionId) {\n          id\n          nom\n        }\n      }\n      avancement {\n        total\n        aFaire\n        enCours\n        faites\n        abandonnees\n        enRetard\n        sansPersonne\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Classement($editionId: ID!) {\n    classement(editionId: $editionId) {\n      rang\n      personne {\n        id\n        nom\n      }\n      score {\n        points\n        tachesRealisees\n        tachesATemps\n        tachesCreees\n        fichesCreees\n        fichesModifiees\n      }\n    }\n  }\n"): (typeof documents)["\n  query Classement($editionId: ID!) {\n    classement(editionId: $editionId) {\n      rang\n      personne {\n        id\n        nom\n      }\n      score {\n        points\n        tachesRealisees\n        tachesATemps\n        tachesCreees\n        fichesCreees\n        fichesModifiees\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreerEdition(\n    $annee: Int!\n    $nom: String!\n    $debut: Date!\n    $fin: Date!\n  ) {\n    creerEdition(annee: $annee, nom: $nom, debut: $debut, fin: $fin) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation CreerEdition(\n    $annee: Int!\n    $nom: String!\n    $debut: Date!\n    $fin: Date!\n  ) {\n    creerEdition(annee: $annee, nom: $nom, debut: $debut, fin: $fin) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ModifierEdition(\n    $id: ID!\n    $nom: String!\n    $debut: Date!\n    $fin: Date!\n    $statut: StatutEdition!\n  ) {\n    modifierEdition(\n      id: $id\n      nom: $nom\n      debut: $debut\n      fin: $fin\n      statut: $statut\n    ) {\n      id\n      nom\n      debut\n      fin\n      statut\n    }\n  }\n"): (typeof documents)["\n  mutation ModifierEdition(\n    $id: ID!\n    $nom: String!\n    $debut: Date!\n    $fin: Date!\n    $statut: StatutEdition!\n  ) {\n    modifierEdition(\n      id: $id\n      nom: $nom\n      debut: $debut\n      fin: $fin\n      statut: $statut\n    ) {\n      id\n      nom\n      debut\n      fin\n      statut\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreerPerimetre(\n    $slug: String!\n    $nom: String!\n    $type: TypePerimetre!\n    $couleur: String\n    $ordre: Int\n  ) {\n    creerPerimetre(\n      slug: $slug\n      nom: $nom\n      type: $type\n      couleur: $couleur\n      ordre: $ordre\n    ) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation CreerPerimetre(\n    $slug: String!\n    $nom: String!\n    $type: TypePerimetre!\n    $couleur: String\n    $ordre: Int\n  ) {\n    creerPerimetre(\n      slug: $slug\n      nom: $nom\n      type: $type\n      couleur: $couleur\n      ordre: $ordre\n    ) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ModifierPerimetre(\n    $id: ID!\n    $nom: String!\n    $type: TypePerimetre!\n    $couleur: String\n    $ordre: Int!\n    $archive: Boolean!\n  ) {\n    modifierPerimetre(\n      id: $id\n      nom: $nom\n      type: $type\n      couleur: $couleur\n      ordre: $ordre\n      archive: $archive\n    ) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation ModifierPerimetre(\n    $id: ID!\n    $nom: String!\n    $type: TypePerimetre!\n    $couleur: String\n    $ordre: Int!\n    $archive: Boolean!\n  ) {\n    modifierPerimetre(\n      id: $id\n      nom: $nom\n      type: $type\n      couleur: $couleur\n      ordre: $ordre\n      archive: $archive\n    ) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Personnes($inclureArchives: Boolean, $editionId: ID) {\n    personnes(inclureArchives: $inclureArchives) {\n      id\n      nom\n      email\n      estAdmin\n      archive\n      affectations(editionId: $editionId) {\n        id\n        perimetre {\n          id\n          nom\n          couleur\n        }\n      }\n      souhaits(editionId: $editionId) {\n        id\n        satisfait\n        perimetre {\n          id\n          nom\n          couleur\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query Personnes($inclureArchives: Boolean, $editionId: ID) {\n    personnes(inclureArchives: $inclureArchives) {\n      id\n      nom\n      email\n      estAdmin\n      archive\n      affectations(editionId: $editionId) {\n        id\n        perimetre {\n          id\n          nom\n          couleur\n        }\n      }\n      souhaits(editionId: $editionId) {\n        id\n        satisfait\n        perimetre {\n          id\n          nom\n          couleur\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation InviterPersonne(\n    $email: String!\n    $nom: String!\n    $estAdmin: Boolean\n    $editionId: ID\n    $perimetresSouhaites: [ID!]\n  ) {\n    inviterPersonne(\n      email: $email\n      nom: $nom\n      estAdmin: $estAdmin\n      editionId: $editionId\n      perimetresSouhaites: $perimetresSouhaites\n    ) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation InviterPersonne(\n    $email: String!\n    $nom: String!\n    $estAdmin: Boolean\n    $editionId: ID\n    $perimetresSouhaites: [ID!]\n  ) {\n    inviterPersonne(\n      email: $email\n      nom: $nom\n      estAdmin: $estAdmin\n      editionId: $editionId\n      perimetresSouhaites: $perimetresSouhaites\n    ) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ModifierPersonne($id: ID!, $nom: String!, $estAdmin: Boolean!) {\n    modifierPersonne(id: $id, nom: $nom, estAdmin: $estAdmin) {\n      id\n      nom\n      estAdmin\n    }\n  }\n"): (typeof documents)["\n  mutation ModifierPersonne($id: ID!, $nom: String!, $estAdmin: Boolean!) {\n    modifierPersonne(id: $id, nom: $nom, estAdmin: $estAdmin) {\n      id\n      nom\n      estAdmin\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ArchiverPersonne($id: ID!, $archive: Boolean!) {\n    archiverPersonne(id: $id, archive: $archive) {\n      id\n      archive\n    }\n  }\n"): (typeof documents)["\n  mutation ArchiverPersonne($id: ID!, $archive: Boolean!) {\n    archiverPersonne(id: $id, archive: $archive) {\n      id\n      archive\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DefinirSouhaits(\n    $personneId: ID!\n    $editionId: ID!\n    $perimetreIds: [ID!]!\n  ) {\n    definirSouhaits(\n      personneId: $personneId\n      editionId: $editionId\n      perimetreIds: $perimetreIds\n    ) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation DefinirSouhaits(\n    $personneId: ID!\n    $editionId: ID!\n    $perimetreIds: [ID!]!\n  ) {\n    definirSouhaits(\n      personneId: $personneId\n      editionId: $editionId\n      perimetreIds: $perimetreIds\n    ) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RenvoyerInvitation($id: ID!) {\n    renvoyerInvitation(id: $id)\n  }\n"): (typeof documents)["\n  mutation RenvoyerInvitation($id: ID!) {\n    renvoyerInvitation(id: $id)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PostesAPourvoir($editionId: ID!) {\n    postesAPourvoir(editionId: $editionId) {\n      effectif\n      aPourvoir\n      etat\n      perimetre {\n        id\n        slug\n        nom\n        type\n        couleur\n      }\n      affectations {\n        id\n        personne {\n          id\n          nom\n        }\n      }\n      souhaits {\n        id\n        personne {\n          id\n          nom\n        }\n      }\n    }\n    appelPostes(editionId: $editionId)\n    personnes {\n      id\n      nom\n    }\n  }\n"): (typeof documents)["\n  query PostesAPourvoir($editionId: ID!) {\n    postesAPourvoir(editionId: $editionId) {\n      effectif\n      aPourvoir\n      etat\n      perimetre {\n        id\n        slug\n        nom\n        type\n        couleur\n      }\n      affectations {\n        id\n        personne {\n          id\n          nom\n        }\n      }\n      souhaits {\n        id\n        personne {\n          id\n          nom\n        }\n      }\n    }\n    appelPostes(editionId: $editionId)\n    personnes {\n      id\n      nom\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DefinirEffectif(\n    $perimetreId: ID!\n    $editionId: ID!\n    $effectif: Int!\n  ) {\n    definirEffectif(\n      perimetreId: $perimetreId\n      editionId: $editionId\n      effectif: $effectif\n    )\n  }\n"): (typeof documents)["\n  mutation DefinirEffectif(\n    $perimetreId: ID!\n    $editionId: ID!\n    $effectif: Int!\n  ) {\n    definirEffectif(\n      perimetreId: $perimetreId\n      editionId: $editionId\n      effectif: $effectif\n    )\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Affecter($personneId: ID!, $perimetreId: ID!, $editionId: ID!) {\n    affecter(\n      personneId: $personneId\n      perimetreId: $perimetreId\n      editionId: $editionId\n    ) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation Affecter($personneId: ID!, $perimetreId: ID!, $editionId: ID!) {\n    affecter(\n      personneId: $personneId\n      perimetreId: $perimetreId\n      editionId: $editionId\n    ) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RetirerAffectation($id: ID!) {\n    retirerAffectation(id: $id)\n  }\n"): (typeof documents)["\n  mutation RetirerAffectation($id: ID!) {\n    retirerAffectation(id: $id)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RetirerSouhait($id: ID!) {\n    retirerSouhait(id: $id)\n  }\n"): (typeof documents)["\n  mutation RetirerSouhait($id: ID!) {\n    retirerSouhait(id: $id)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query DroitsRedaction {\n    droitsRedaction {\n      id\n      accordeLe\n      personne {\n        id\n        nom\n      }\n      perimetre {\n        id\n        nom\n      }\n    }\n    personnes {\n      id\n      nom\n    }\n  }\n"): (typeof documents)["\n  query DroitsRedaction {\n    droitsRedaction {\n      id\n      accordeLe\n      personne {\n        id\n        nom\n      }\n      perimetre {\n        id\n        nom\n      }\n    }\n    personnes {\n      id\n      nom\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AccorderDroitRedaction($personneId: ID!, $perimetreId: ID) {\n    accorderDroitRedaction(personneId: $personneId, perimetreId: $perimetreId) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation AccorderDroitRedaction($personneId: ID!, $perimetreId: ID) {\n    accorderDroitRedaction(personneId: $personneId, perimetreId: $perimetreId) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RetirerDroitRedaction($id: ID!) {\n    retirerDroitRedaction(id: $id)\n  }\n"): (typeof documents)["\n  mutation RetirerDroitRedaction($id: ID!) {\n    retirerDroitRedaction(id: $id)\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;