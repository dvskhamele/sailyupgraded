"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { assignUserToTeam, removeUserFromTeam, bulkAssignUsersToTeam } from "@/actions/crm/teams/assign-user";
import { searchUsers } from "@/actions/user/search-users";
import { useRouter } from "next/navigation";

interface MembersViewProps {
  teamId: string;
  members: any[];
  allUsers: any[];
  allTeams: any[];
}

export const MembersView: React.FC<MembersViewProps> = ({
  teamId,
  members,
  allUsers,
  allTeams,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length > 0) {
      const results = await searchUsers({ search: query });
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const handleAddMember = async (userId: string) => {
    setLoading(true);
    try {
      const result = await assignUserToTeam({ userId, teamId });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("User added to team");
        setAddMemberOpen(false);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to add user to team");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setLoading(true);
    try {
      const result = await removeUserFromTeam({ userId });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("User removed from team");
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to remove user from team");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedUsers.length === 0) return;
    setLoading(true);
    try {
      const result = await bulkAssignUsersToTeam({
        userIds: selectedUsers,
        teamId,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Users added to team");
        setSelectedUsers([]);
        setAddMemberOpen(false);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to add users to team");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeTeam = async (userId: string, newTeamId: string | null) => {
    setLoading(true);
    try {
      const result = await assignUserToTeam({ userId, teamId: newTeamId });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("User team changed");
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to change user team");
    } finally {
      setLoading(false);
    }
  };

  const availableUsers = allUsers.filter(
    (user) => !members.some((member) => member.id === user.id)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Team Members</CardTitle>
          <Sheet open={addMemberOpen} onOpenChange={setAddMemberOpen}>
            <SheetTrigger asChild>
              <Button size="sm">Add Members</Button>
            </SheetTrigger>
            <SheetContent className="w-full md:max-[771px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Add Members</SheetTitle>
                <SheetDescription>Search and add users to the team</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {searchQuery.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-2 border rounded"
                      >
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddMember(user.id)}
                          disabled={loading}
                        >
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Separator />
                <div>
                  <h3 className="text-sm font-medium mb-2">Or select multiple users:</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-2 border rounded"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUsers([...selectedUsers, user.id]);
                              } else {
                                setSelectedUsers(
                                  selectedUsers.filter((id) => id !== user.id)
                                );
                              }
                            }}
                          />
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedUsers.length > 0 && (
                    <Button
                      className="mt-4 w-full"
                      onClick={handleBulkAssign}
                      disabled={loading}
                    >
                      Add Selected ({selectedUsers.length})
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <Separator className="my-4" />
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-muted-foreground">No members in this team yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.role}</TableCell>
                    <TableCell className="flex gap-2">
                      <Select
                        defaultValue={teamId}
                        onValueChange={(value) =>
                          handleChangeTeam(member.id, value === "none" ? null : value)
                        }
                        disabled={loading}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Change team" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Team</SelectItem>
                          {allTeams
                            .filter((t) => t.id !== teamId && !t.deletedAt)
                            .map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={loading}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};