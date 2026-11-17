from app.services.bangla_answer_quality import select_answer_quality_reply


def ask(question):
    return select_answer_quality_reply(
        [{"role": "user", "content": question}], {}
    )


def test_fish_no_gasp_direct_answer():
    result = ask("আমার পুকুরে মাছ হাঁসফাঁস করছে না, সব ঠিক আছে?")
    assert result is not None
    assert result[1] == "fish_no_gasp_check"


def test_fish_duck_mixed_farming():
    result = ask("আমি পুকুরে মাছ ও হাঁস একসাথে পালন করতে চাই, কী করব?")
    assert result is not None
    assert result[1] == "fish_duck_joint_farming"
