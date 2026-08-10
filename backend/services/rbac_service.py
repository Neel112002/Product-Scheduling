def can_modify_role(current_emp, target_emp):
    current_role = current_emp.role.name.lower()
    target_role = target_emp.role.name.lower()

    if current_role == "owner":
        return target_role != "owner"

    if current_role == "manager":
        return target_role == "staff"

    return False