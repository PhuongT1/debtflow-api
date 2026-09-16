import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationMembershipStatus, Prisma, UserStatus } from '@generated/prisma';
import { PrismaService } from '@database/prisma.service';
import { getPagination, paginate } from '@common/utils/pagination.util';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
@Injectable()
export class UsersService {
 constructor(private readonly prisma: PrismaService) {}
 async list(organizationId:string, query:QueryUsersDto){const pagination=getPagination(query); const where:Prisma.OrganizationMembershipWhereInput={organizationId,status: query.status as OrganizationMembershipStatus | undefined,role:query.role,...(query.q?{user:{OR:[{name:{contains:query.q,mode:'insensitive'}},{email:{contains:query.q,mode:'insensitive'}},{phone:{contains:query.q,mode:'insensitive'}}]}}:{})};const [items,total]=await this.prisma.$transaction([this.prisma.organizationMembership.findMany({where,orderBy:{createdAt:'desc'},skip:pagination.skip,take:pagination.take,include:{user:{select:{id:true,name:true,email:true,phone:true,status:true,systemRole:true}}}}),this.prisma.organizationMembership.count({where})]);return paginate(items.map(({user,...membership})=>({...user,...membership})),total,pagination)}
 options(organizationId:string){return this.prisma.organizationMembership.findMany({where:{organizationId,status:OrganizationMembershipStatus.ACTIVE,user:{status:UserStatus.ACTIVE}},orderBy:{user:{name:'asc'}},select:{user:{select:{id:true,name:true,email:true,status:true}},role:true}}).then(items=>items.map(({user,role})=>({...user,role})));}
 async update(organizationId:string,id:string,body:UpdateUserDto){const membership=await this.prisma.organizationMembership.findFirst({where:{organizationId,userId:id}});if(!membership)throw new NotFoundException();const user=await this.prisma.user.update({where:{id},data:{name:body.name,phone:body.phone,status:body.status},select:{id:true,name:true,email:true,phone:true,status:true}});const updated=body.role?await this.prisma.organizationMembership.update({where:{id:membership.id},data:{role:body.role},select:{role:true,status:true}}):membership;return {...user,role:updated.role,membershipStatus:updated.status}}
 async deactivate(organizationId:string,id:string){const membership=await this.prisma.organizationMembership.findFirst({where:{organizationId,userId:id}});if(!membership)throw new NotFoundException();return this.prisma.organizationMembership.update({where:{id:membership.id},data:{status:OrganizationMembershipStatus.SUSPENDED}})}
}
