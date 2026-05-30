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
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './team.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamService {
  constructor(
    // @InjectRepository(Team) : demande à TypeORM d'injecter le Repository<Team>
    // Le Repository est le DAO (Data Access Object) : il expose find(), save(), etc.
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
  ) {}

  /**
   * Retourne toutes les équipes appartenant à l'utilisateur.
   * La clause `where: { userId }` est traduite en SQL : WHERE "userId" = $1
   */
  async findByUserId(userId: number): Promise<Team[]> {
    return this.teamRepo.find({ where: { userId } });
  }

  /**
   * Retourne une équipe précise, uniquement si elle appartient à l'utilisateur.
   *
   * On filtre toujours sur `userId` en plus de `id` : même si un attaquant
   * devine l'id d'une autre équipe, la requête ne retournera rien.
   *
   * Lève NotFoundException (HTTP 404) si l'équipe est introuvable.
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
   */
  async create(userId: number, dto: CreateTeamDto): Promise<Team> {
    const team = this.teamRepo.create({
      ...dto,
      userId, // On force le userId depuis le token JWT, pas depuis le body
    });
    return this.teamRepo.save(team);
  }

  /**
   * Met à jour une équipe existante.
   *
   * On récupère d'abord l'équipe via findOneForUser() pour vérifier
   * qu'elle existe ET qu'elle appartient à l'utilisateur.
   * Object.assign() applique uniquement les champs fournis dans le DTO.
   */
  async update(id: number, userId: number, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOneForUser(id, userId);
    Object.assign(team, dto);
    return this.teamRepo.save(team);
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
