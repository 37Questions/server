import codecs
import csv

print("Starting SQL Generation")

questions = []

with codecs.open("questions.csv", "r", encoding="utf8") as spreadsheet:
  reader = csv.reader(spreadsheet, delimiter=",")
  for row in reader:
    question = row[0].replace("'", "\\'").replace("\n", "\\n")
    questions.append("(\"" + question + "\")")

print("Parsed " + str(len(questions)) + " questions")

with codecs.open("questions.sql", "w", encoding="utf8") as sql:
  sql.write("INSERT INTO questions (question) VALUES ")
  sql.write(", ".join(questions))
  sql.write(";\n")

print("Saved output to generated.sql")
