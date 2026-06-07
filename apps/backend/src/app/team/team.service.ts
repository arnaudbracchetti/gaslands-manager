/**
 * TeamService — logique métier pour la gestion des équipes.
 *
 * Ce service est le seul point d'accès à la base de données pour les équipes.
 * Le controller ne touche jamais directement au Repository — il passe toujours
 * par le service. Cette séparation facilite les tests (on peut mocker le service).
 *
 * Principe de sécurité fondamental :
 * Toutes les méthodes qui accèdent à une équipe spécifique prennent un `userId`
 * en paramètre et vérifient que l'équipe appartient bien à cet utilisateur.
 * Cela empêche un utilisateur A de voir ou modifier les équipes d'un utilisateur B.
 *
 * vehicleCount : chaque équipe retournée inclut un compteur de véhicules,
 * calculé via un `COUNT` SQL sur la table `vehicles` (cf. `countVehicles`
 * ci-dessous) — jamais stocké en colonne, pour ne jamais désynchroniser ce
 * compteur de la réalité (cf. `TeamWithCount`, ARCHITECTURE.md §3.4). Ce champ
 * est utilisé par le frontend pour verrouiller le choix du sponsor dès qu'un
 * premier véhicule est ajouté à l'équipe.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './team.entity';
import { Vehicle } from '../vehicle/vehicle.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamResponseDto } from './dto/team-response.dto';

@Injectable()
export class TeamService {
  constructor(
    // @InjectRepository(Team) : demande à TypeORM d'injecter le Repository<Team>
    // Le Repository est le DAO (Data Access Object) : il expose find(), save(), etc.
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
    // Repository<Vehicle> — uniquement pour COMPTER (cf. `countVehicles`), jamais
    // pour lire/écrire des véhicules (ce serait le rôle de `VehicleService`).
    // Enregistré directement via `forFeature([Team, Vehicle])` dans `TeamModule`
    // plutôt qu'en important `VehicleModule` — voir son en-tête pour la raison
    // (éviter tout cycle `TeamModule ↔ VehicleModule`).
    @InjectRepository(Vehicle)
    private vehicleRepo: Repository<Vehicle>,
  ) {}

  /**
   * Compte les véhicules d'une équipe — un simple `SELECT COUNT(*) WHERE teamId = …`.
   * Extrait en méthode privée car utilisé à deux endroits (`findByUserId`/`update`)
   * avec exactement la même logique : éviter de la dupliquer, et donner un nom
   * qui documente l'intention au lieu d'un `count(...)` anonyme répété.
   */
  private countVehicles(teamId: number): Promise<number> {
    return this.vehicleRepo.count({ where: { teamId } });
  }

  /**
   * Retourne toutes les équipes appartenant à l'utilisateur, enrichies avec
   * vehicleCount — un vrai comptage SQL, un par équipe.
   *
   * N équipes ⇒ N requêtes `COUNT` — un schéma "N+1" assumé et documenté :
   * le nombre d'équipes par utilisateur reste typiquement faible (quelques
   * unités), et chaque requête est triviale (index sur `teamId`). Une
   * optimisation grouperait les comptages en une seule requête (`GROUP BY
   * teamId`) si ce nombre devenait significatif — pas nécessaire ici.
   *
   * La clause `where: { userId }` est traduite en SQL : WHERE "userId" = $1
   */
  async findByUserId(userId: number): Promise<TeamResponseDto[]> {
    const teams = await this.teamRepo.find({ where: { userId } });
    return Promise.all(
      teams.map(
        async (team: Team): Promise<TeamResponseDto> => ({
          ...team,
          vehicleCount: await this.countVehicles(team.id),
        }),
      ),
    );
  }

  /**
   * Retourne une équipe précise, uniquement si elle appartient à l'utilisateur.
   *
   * On filtre toujours sur `userId` en plus de `id` : même si un attaquant
   * devine l'id d'une autre équipe, la requête ne retournera rien.
   *
   * Lève NotFoundException (HTTP 404) si l'équipe est introuvable.
   *
   * Note : retourne l'entité brute (sans vehicleCount) — utilisé en interne
   * pour les opérations de mise à jour / suppression.
   */
  async findOneForUser(id: number, userId: number): Promise<Team> {
    const team = await this.teamRepo.findOne({ where: { id, userId } });
    if (!team) {
      throw new NotFoundException(`Équipe #${id} introuvable`);
    }
    return team;
  }

  /**
   * Crée une nouvelle équipe liée à l'utilisateur connecté.
   *
   * teamRepo.create() instancie l'objet Team en mémoire (sans toucher la BDD).
   * teamRepo.save() exécute l'INSERT et retourne l'entité avec son id généré.
   * `vehicleCount: 0` ici n'est PAS un placeholder (contrairement à l'ancienne
   * version de ce service) : une équipe tout juste créée n'a, par construction,
   * encore aucun véhicule — la valeur est exacte sans qu'il soit besoin de
   * `countVehicles` (qui interrogerait la BDD pour redécouvrir un fait déjà connu).
   */
  async create(userId: number, dto: CreateTeamDto): Promise<TeamResponseDto> {
    const team = this.teamRepo.create({
      ...dto,
      userId, // On force le userId depuis le token JWT, pas depuis le body
    });
    const saved = await this.teamRepo.save(team);
    return { ...saved, vehicleCount: 0 };
  }

  /**
   * Met à jour une équipe existante.
   *
   * On récupère d'abord l'équipe via findOneForUser() pour vérifier
   * qu'elle existe ET qu'elle appartient à l'utilisateur.
   * Object.assign() applique uniquement les champs fournis dans le DTO.
   * Retourne l'équipe mise à jour enrichie avec vehicleCount.
   */
  async update(id: number, userId: number, dto: UpdateTeamDto): Promise<TeamResponseDto> {
    const team = await this.findOneForUser(id, userId);
    Object.assign(team, dto);
    const saved = await this.teamRepo.save(team);
    return { ...saved, vehicleCount: await this.countVehicles(saved.id) };
  }

  /**
   * Supprime une équipe.
   *
   * Même principe : on vérifie l'appartenance avant de supprimer.
   * teamRepo.remove() exécute un DELETE FROM teams WHERE id = $1
   */
  async remove(id: number, userId: number): Promise<void> {
    const team = await this.findOneForUser(id, userId);
    await this.teamRepo.remove(team);
  }
}
