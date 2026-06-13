from utils.validators import is_valid_date, is_valid_uuid


def test_input_validators_accept_supported_identifiers():
    assert is_valid_date("2026-06-12")
    assert not is_valid_date("12-06-2026")
    assert is_valid_uuid("123e4567-e89b-12d3-a456-426614174000")
    assert not is_valid_uuid("not-a-uuid")
